package com.example.tourism.controller;

import com.example.tourism.model.UserAccount;
import com.example.tourism.repository.UserAccountRepository;
import com.example.tourism.util.HashUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserAccountRepository repository;

    public UserController(UserAccountRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<UserAccount> list() {
        return repository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserAccount> get(@PathVariable Long id) {
        return repository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody UserCreateRequest request) {
        if (request == null || request.email == null || request.email.isBlank() || request.username == null || request.username.isBlank()) {
            return ResponseEntity.badRequest().body("Username and email are required.");
        }
        if (repository.existsByEmail(request.email.trim().toLowerCase())) {
            return ResponseEntity.badRequest().body("Email already exists.");
        }

        UserAccount user = new UserAccount();
        user.setUsername(request.username.trim());
        user.setEmail(request.email.trim().toLowerCase());
        user.setRole(request.role != null && !request.role.isBlank() ? request.role.toLowerCase() : "tourist");
        user.setNationality(request.nationality);
        user.setTravelCompanions(request.travelCompanions != null ? Math.max(1, request.travelCompanions) : 1);
        user.setMfaEnabled(request.mfaEnabled != null && request.mfaEnabled);
        user.setPasswordHash(HashUtils.sha256(request.password != null ? request.password : "change-me"));
        user.setCreatedAt(LocalDateTime.now());
        return ResponseEntity.ok(repository.save(user));
    }

    public static class UserCreateRequest {
        public String username;
        public String email;
        public String password;
        public String role;
        public String nationality;
        public Integer travelCompanions;
        public Boolean mfaEnabled;
    }
}
