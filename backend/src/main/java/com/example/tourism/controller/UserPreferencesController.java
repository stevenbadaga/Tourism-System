package com.example.tourism.controller;

import com.example.tourism.model.UserAccount;
import com.example.tourism.model.UserPreferences;
import com.example.tourism.repository.UserAccountRepository;
import com.example.tourism.repository.UserPreferencesRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/preferences")
public class UserPreferencesController {

    private final UserPreferencesRepository repository;
    private final UserAccountRepository userRepository;

    public UserPreferencesController(UserPreferencesRepository repository, UserAccountRepository userRepository) {
        this.repository = repository;
        this.userRepository = userRepository;
    }

    @GetMapping
    public List<UserPreferences> list() {
        return repository.findAll();
    }

    @GetMapping("/{userId}")
    public UserPreferences get(@PathVariable Long userId) {
        return repository.findByUserId(userId)
                .orElse(null);
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody UserPreferences p) {
        if (p == null || p.getUser() == null || p.getUser().getId() == null) {
            return ResponseEntity.badRequest().body("User id is required.");
        }
        UserAccount user = userRepository.findById(p.getUser().getId()).orElse(null);
        if (user == null) return ResponseEntity.badRequest().body("User not found.");

        UserPreferences target = repository.findByUserId(user.getId()).orElse(new UserPreferences(user));
        target.setUser(user);
        target.setInterests(p.getInterests());
        target.setPreferences(p.getPreferences());
        target.setBudgetRange(p.getBudgetRange());
        target.setAccessibility(p.getAccessibility());
        target.setNationality(p.getNationality());
        return ResponseEntity.ok(repository.save(target));
    }

    @PutMapping("/{userId}")
    public ResponseEntity<?> update(@PathVariable Long userId, @RequestBody UserPreferences p) {
        UserAccount user = userRepository.findById(userId).orElse(null);
        if (user == null) return ResponseEntity.badRequest().body("User not found.");

        UserPreferences updated = repository.findByUserId(userId)
                .map(existing -> {
                    existing.setInterests(p.getInterests());
                    existing.setPreferences(p.getPreferences());
                    existing.setBudgetRange(p.getBudgetRange());
                    existing.setAccessibility(p.getAccessibility());
                    existing.setNationality(p.getNationality());
                    existing.setUser(user);
                    return repository.save(existing);
                })
                .orElseGet(() -> {
                    UserPreferences created = new UserPreferences(user);
                    created.setInterests(p.getInterests());
                    created.setPreferences(p.getPreferences());
                    created.setBudgetRange(p.getBudgetRange());
                    created.setAccessibility(p.getAccessibility());
                    created.setNationality(p.getNationality());
                    return repository.save(created);
                });
        return ResponseEntity.ok(updated);
    }
}
