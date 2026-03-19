package com.example.tourism.controller;

import com.example.tourism.model.Itinerary;
import com.example.tourism.model.UserAccount;
import com.example.tourism.repository.ItineraryRepository;
import com.example.tourism.repository.UserAccountRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/itineraries")
public class ItineraryController {

    private final ItineraryRepository repository;
    private final UserAccountRepository userRepository;

    public ItineraryController(ItineraryRepository repository, UserAccountRepository userRepository) {
        this.repository = repository;
        this.userRepository = userRepository;
    }

    @GetMapping
    public List<Itinerary> list(@RequestParam(required = false) Long userId) {
        if (userId != null) return repository.findByUserId(userId);
        return repository.findAll();
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody ItineraryRequest request) {
        if (request == null || request.title == null || request.title.isBlank()) {
            return ResponseEntity.badRequest().body("Title is required.");
        }
        Long userId = request.userId != null ? request.userId : request.user != null ? request.user.getId() : null;
        if (userId == null) return ResponseEntity.badRequest().body("User id is required.");

        UserAccount user = userRepository.findById(userId).orElse(null);
        if (user == null) return ResponseEntity.badRequest().body("User not found.");

        Itinerary itinerary = new Itinerary();
        itinerary.setUser(user);
        itinerary.setTitle(request.title);
        itinerary.setDescription(request.description);
        itinerary.setVisibility(request.visibility != null ? request.visibility : "private");
        itinerary.setCollaborators(request.collaborators);
        itinerary.setTripDate(request.tripDate);
        itinerary.setTripLength(request.tripLength != null ? Math.max(1, Math.min(30, request.tripLength)) : 1);
        itinerary.setActivitiesJson(request.activitiesJson);
        itinerary.setCreatedAt(request.createdAt != null ? request.createdAt : LocalDateTime.now());
        return ResponseEntity.ok(repository.save(itinerary));
    }

    public static class ItineraryRequest {
        public Long userId;
        public UserAccount user;
        public String title;
        public String description;
        public String visibility;
        public String collaborators;
        public LocalDate tripDate;
        public Integer tripLength;
        public String activitiesJson;
        public LocalDateTime createdAt;
    }
}
