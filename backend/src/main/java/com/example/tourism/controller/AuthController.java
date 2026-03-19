package com.example.tourism.controller;

import com.example.tourism.model.UserAccount;
import com.example.tourism.model.UserPreferences;
import com.example.tourism.repository.BookingRepository;
import com.example.tourism.repository.UserAccountRepository;
import com.example.tourism.repository.UserPreferencesRepository;
import com.example.tourism.util.HashUtils;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Set<String> ALLOWED_ROLES = Set.of("tourist", "agent", "admin");

    private final UserAccountRepository userRepository;
    private final BookingRepository bookingRepository;
    private final UserPreferencesRepository preferencesRepository;

    private final Map<String, SessionRecord> sessions = new ConcurrentHashMap<>();
    private final Map<String, PendingMfaChallenge> mfaChallenges = new ConcurrentHashMap<>();

    public AuthController(UserAccountRepository userRepository, BookingRepository bookingRepository, UserPreferencesRepository preferencesRepository) {
        this.userRepository = userRepository;
        this.bookingRepository = bookingRepository;
        this.preferencesRepository = preferencesRepository;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        if (request == null || isBlank(request.username) || isBlank(request.email) || isBlank(request.password)) {
            return ResponseEntity.badRequest().body("Username, email and password are required.");
        }

        String normalizedEmail = request.email.trim().toLowerCase(Locale.ROOT);
        if (userRepository.existsByEmail(normalizedEmail)) {
            return ResponseEntity.badRequest().body("Email already registered.");
        }

        if (!isValidPassword(request.password)) {
            return ResponseEntity.badRequest().body("Password must be at least 8 characters and include letters and numbers.");
        }

        UserAccount user = new UserAccount();
        user.setUsername(request.username.trim());
        user.setEmail(normalizedEmail);
        user.setRole(normalizeRole(request.role));
        user.setNationality(request.nationality);
        user.setTravelCompanions(request.travelCompanions != null ? Math.max(1, request.travelCompanions) : 1);
        user.setMfaEnabled(request.mfaEnabled != null && request.mfaEnabled);
        user.setPasswordHash(HashUtils.sha256(request.password));
        user.setCreatedAt(LocalDateTime.now());
        return ResponseEntity.ok(userRepository.save(user));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        if (request == null || isBlank(request.email) || isBlank(request.password)) {
            return ResponseEntity.badRequest().body("Email and password are required.");
        }

        String normalizedEmail = request.email.trim().toLowerCase(Locale.ROOT);
        UserAccount user = userRepository.findByEmail(normalizedEmail).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid credentials.");
        }

        String hash = HashUtils.sha256(request.password);
        if (!Objects.equals(user.getPasswordHash(), hash)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid credentials.");
        }

        if (Boolean.TRUE.equals(user.isMfaEnabled())) {
            return ResponseEntity.ok(issueMfaChallenge(user, request.mfaMethod));
        }

        SessionRecord session = createSession(user, request.deviceName, request.location, "password");
        return ResponseEntity.ok(successResponse(user, session, "Login successful"));
    }

    @PostMapping("/social-login")
    public ResponseEntity<?> socialLogin(@RequestBody SocialLoginRequest request) {
        if (request == null || isBlank(request.provider) || isBlank(request.email) || isBlank(request.externalToken)) {
            return ResponseEntity.badRequest().body("Provider, email, and external token are required.");
        }

        String provider = request.provider.trim().toLowerCase(Locale.ROOT);
        if (!List.of("google", "apple", "facebook").contains(provider)) {
            return ResponseEntity.badRequest().body("Unsupported social provider.");
        }

        String normalizedEmail = request.email.trim().toLowerCase(Locale.ROOT);
        UserAccount user = userRepository.findByEmail(normalizedEmail).orElseGet(() -> {
            UserAccount created = new UserAccount();
            created.setUsername(!isBlank(request.displayName) ? request.displayName.trim() : provider + "-user");
            created.setEmail(normalizedEmail);
            created.setRole(normalizeRole(request.role));
            created.setNationality(request.nationality);
            created.setTravelCompanions(1);
            created.setMfaEnabled(false);
            created.setPasswordHash(HashUtils.sha256(UUID.randomUUID().toString()));
            created.setCreatedAt(LocalDateTime.now());
            return userRepository.save(created);
        });

        if (Boolean.TRUE.equals(user.isMfaEnabled())) {
            return ResponseEntity.ok(issueMfaChallenge(user, request.mfaMethod));
        }

        SessionRecord session = createSession(user, request.deviceName, request.location, provider);
        return ResponseEntity.ok(successResponse(user, session, "Social login successful"));
    }

    @PostMapping("/sso")
    public ResponseEntity<?> ssoLogin(@RequestBody SsoLoginRequest request) {
        if (request == null || isBlank(request.provider) || isBlank(request.email) || isBlank(request.assertion)) {
            return ResponseEntity.badRequest().body("Provider, email, and SSO assertion are required.");
        }

        String provider = request.provider.trim().toLowerCase(Locale.ROOT);
        if (!List.of("azure-ad", "okta", "auth0", "google-workspace").contains(provider)) {
            return ResponseEntity.badRequest().body("Unsupported SSO provider.");
        }

        String normalizedEmail = request.email.trim().toLowerCase(Locale.ROOT);
        UserAccount user = userRepository.findByEmail(normalizedEmail).orElseGet(() -> {
            UserAccount created = new UserAccount();
            created.setUsername(!isBlank(request.displayName) ? request.displayName.trim() : "SSO User");
            created.setEmail(normalizedEmail);
            created.setRole(normalizeRole(request.role));
            created.setNationality(request.nationality);
            created.setTravelCompanions(1);
            created.setMfaEnabled(false);
            created.setPasswordHash(HashUtils.sha256(UUID.randomUUID().toString()));
            created.setCreatedAt(LocalDateTime.now());
            return userRepository.save(created);
        });

        if (Boolean.TRUE.equals(user.isMfaEnabled())) {
            return ResponseEntity.ok(issueMfaChallenge(user, request.mfaMethod));
        }

        SessionRecord session = createSession(user, request.deviceName, request.location, "sso:" + provider);
        return ResponseEntity.ok(successResponse(user, session, "SSO login successful"));
    }

    @PostMapping("/mfa/verify")
    public ResponseEntity<?> verifyMfa(@RequestBody MfaVerifyRequest request) {
        if (request == null || isBlank(request.challengeId) || isBlank(request.code)) {
            return ResponseEntity.badRequest().body("Challenge id and verification code are required.");
        }

        PendingMfaChallenge challenge = mfaChallenges.get(request.challengeId);
        if (challenge == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("MFA challenge is invalid or expired.");
        }

        if (challenge.expiresAt.isBefore(LocalDateTime.now())) {
            mfaChallenges.remove(request.challengeId);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("MFA challenge expired.");
        }

        String hash = HashUtils.sha256(request.code.trim());
        if (!Objects.equals(hash, challenge.codeHash)) {
            challenge.attempts += 1;
            if (challenge.attempts >= 5) {
                mfaChallenges.remove(request.challengeId);
            }
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid MFA verification code.");
        }

        UserAccount user = userRepository.findById(challenge.userId).orElse(null);
        if (user == null) {
            mfaChallenges.remove(request.challengeId);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("MFA user context is no longer available.");
        }

        SessionRecord session = createSession(user, request.deviceName, request.location, challenge.authMethod);
        mfaChallenges.remove(request.challengeId);
        return ResponseEntity.ok(successResponse(user, session, "MFA verification successful"));
    }

    @PostMapping("/guest")
    public ResponseEntity<?> guestAccess() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("mode", "guest");
        response.put("user", Map.of("id", "guest", "username", "Guest Traveler", "role", "guest"));
        response.put("permissions", List.of("view_attractions", "view_map", "view_recommendations", "view_notifications"));
        response.put("message", "Guest mode enabled.");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/recover")
    public ResponseEntity<?> recover(@RequestBody RecoverRequest request) {
        if (request == null || isBlank(request.email)) {
            return ResponseEntity.badRequest().body("Email is required.");
        }
        Map<String, String> payload = new LinkedHashMap<>();
        payload.put("status", "ok");
        payload.put("message", "Recovery instructions queued for " + request.email.trim().toLowerCase(Locale.ROOT));
        return ResponseEntity.ok(payload);
    }

    @GetMapping("/sessions")
    public List<SessionRecord> listSessions(@RequestParam Long userId) {
        return sessions.values().stream()
                .filter(session -> Objects.equals(session.userId, userId))
                .sorted(Comparator.comparing((SessionRecord session) -> session.lastSeen).reversed())
                .toList();
    }

    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<?> revokeSession(@PathVariable String sessionId) {
        SessionRecord removed = sessions.remove(sessionId);
        if (removed == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(removed);
    }

    @PutMapping("/mfa/{userId}")
    public ResponseEntity<?> updateMfa(@PathVariable Long userId, @RequestBody MfaRequest request) {
        UserAccount user = userRepository.findById(userId).orElse(null);
        if (user == null) return ResponseEntity.notFound().build();
        user.setMfaEnabled(request != null && request.enabled);
        return ResponseEntity.ok(userRepository.save(user));
    }

    @GetMapping("/export/{userId}")
    public ResponseEntity<?> exportUserData(@PathVariable Long userId) {
        UserAccount user = userRepository.findById(userId).orElse(null);
        if (user == null) return ResponseEntity.notFound().build();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("generatedAt", LocalDateTime.now());
        payload.put("user", user);
        payload.put("preferences", preferencesRepository.findByUserId(userId).orElse(null));
        payload.put("bookings", bookingRepository.findByUserId(userId));
        payload.put("sessions", listSessions(userId));
        return ResponseEntity.ok(payload);
    }

    @DeleteMapping("/account/{userId}")
    public ResponseEntity<?> deleteAccount(@PathVariable Long userId) {
        UserAccount user = userRepository.findById(userId).orElse(null);
        if (user == null) return ResponseEntity.notFound().build();

        UserPreferences preferences = preferencesRepository.findByUserId(userId).orElse(null);
        if (preferences != null) preferencesRepository.delete(preferences);

        bookingRepository.findByUserId(userId).forEach(bookingRepository::delete);
        userRepository.delete(user);
        sessions.values().removeIf(session -> Objects.equals(session.userId, userId));
        mfaChallenges.values().removeIf(challenge -> Objects.equals(challenge.userId, userId));
        return ResponseEntity.ok(Map.of("status", "deleted"));
    }

    private SessionRecord createSession(UserAccount user, String deviceName, String location, String authMethod) {
        SessionRecord session = new SessionRecord();
        session.id = UUID.randomUUID().toString();
        session.userId = user.getId();
        session.deviceName = !isBlank(deviceName) ? deviceName : "Web Client";
        session.location = !isBlank(location) ? location : "Unknown";
        session.authMethod = !isBlank(authMethod) ? authMethod : "password";
        session.createdAt = LocalDateTime.now();
        session.lastSeen = LocalDateTime.now();
        sessions.put(session.id, session);
        return session;
    }

    private LoginResponse issueMfaChallenge(UserAccount user, String requestedMethod) {
        String method = normalizeMfaMethod(requestedMethod);
        String challengeId = UUID.randomUUID().toString();
        String code = String.format("%06d", ThreadLocalRandom.current().nextInt(0, 1000000));

        PendingMfaChallenge challenge = new PendingMfaChallenge();
        challenge.challengeId = challengeId;
        challenge.userId = user.getId();
        challenge.codeHash = HashUtils.sha256(code);
        challenge.method = method;
        challenge.authMethod = "mfa-" + method;
        challenge.createdAt = LocalDateTime.now();
        challenge.expiresAt = LocalDateTime.now().plusMinutes(5);
        challenge.attempts = 0;
        mfaChallenges.put(challengeId, challenge);

        LoginResponse response = new LoginResponse();
        response.user = user;
        response.sessionId = null;
        response.message = "MFA challenge issued. Verify code to complete sign-in.";
        response.challengeRequired = true;
        response.challengeId = challengeId;
        response.mfaMethod = method;
        response.mfaDeliveryTarget = maskDeliveryTarget(user.getEmail(), method);
        response.mfaDemoCode = code;
        return response;
    }

    private LoginResponse successResponse(UserAccount user, SessionRecord session, String message) {
        LoginResponse response = new LoginResponse();
        response.user = user;
        response.sessionId = session.id;
        response.message = message;
        response.challengeRequired = false;
        response.challengeId = null;
        response.mfaMethod = null;
        response.mfaDeliveryTarget = null;
        response.mfaDemoCode = null;
        return response;
    }

    private String normalizeRole(String role) {
        if (isBlank(role)) return "tourist";
        String normalized = role.trim().toLowerCase(Locale.ROOT);
        return ALLOWED_ROLES.contains(normalized) ? normalized : "tourist";
    }

    private String normalizeMfaMethod(String value) {
        if (isBlank(value)) return "authenticator";
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        if (List.of("authenticator", "sms", "email").contains(normalized)) return normalized;
        return "authenticator";
    }

    private String maskDeliveryTarget(String email, String method) {
        if ("sms".equals(method)) return "*** *** 1234";
        if (isBlank(email)) return "registered channel";
        String local = email.split("@")[0];
        String domain = email.contains("@") ? email.substring(email.indexOf("@") + 1) : "mail";
        String maskedLocal = local.length() <= 2 ? "**" : local.substring(0, 2) + "***";
        return maskedLocal + "@" + domain;
    }

    private boolean isValidPassword(String value) {
        if (isBlank(value) || value.length() < 8) return false;
        boolean hasLetter = value.chars().anyMatch(Character::isLetter);
        boolean hasDigit = value.chars().anyMatch(Character::isDigit);
        return hasLetter && hasDigit;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    public static class RegisterRequest {
        public String username;
        public String email;
        public String password;
        public String role;
        public String nationality;
        public Integer travelCompanions;
        public Boolean mfaEnabled;
    }

    public static class LoginRequest {
        public String email;
        public String password;
        public String deviceName;
        public String location;
        public String mfaMethod;
    }

    public static class SocialLoginRequest {
        public String provider;
        public String externalToken;
        public String email;
        public String displayName;
        public String role;
        public String nationality;
        public String deviceName;
        public String location;
        public String mfaMethod;
    }

    public static class SsoLoginRequest {
        public String provider;
        public String assertion;
        public String email;
        public String displayName;
        public String role;
        public String nationality;
        public String deviceName;
        public String location;
        public String mfaMethod;
    }

    public static class RecoverRequest {
        public String email;
    }

    public static class MfaRequest {
        public boolean enabled;
    }

    public static class MfaVerifyRequest {
        public String challengeId;
        public String code;
        public String deviceName;
        public String location;
    }

    public static class LoginResponse {
        public UserAccount user;
        public String sessionId;
        public String message;
        public boolean challengeRequired;
        public String challengeId;
        public String mfaMethod;
        public String mfaDeliveryTarget;
        public String mfaDemoCode;
    }

    public static class SessionRecord {
        public String id;
        public Long userId;
        public String deviceName;
        public String location;
        public String authMethod;
        public LocalDateTime createdAt;
        public LocalDateTime lastSeen;
    }

    public static class PendingMfaChallenge {
        public String challengeId;
        public Long userId;
        public String codeHash;
        public String method;
        public String authMethod;
        public LocalDateTime createdAt;
        public LocalDateTime expiresAt;
        public int attempts;
    }
}
