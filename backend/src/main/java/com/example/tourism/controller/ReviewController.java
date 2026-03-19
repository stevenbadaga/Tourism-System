package com.example.tourism.controller;

import com.example.tourism.model.Attraction;
import com.example.tourism.model.Review;
import com.example.tourism.model.UserAccount;
import com.example.tourism.repository.AttractionRepository;
import com.example.tourism.repository.ReviewRepository;
import com.example.tourism.repository.UserAccountRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/reviews")
public class ReviewController {

    private final ReviewRepository repository;
    private final UserAccountRepository userRepository;
    private final AttractionRepository attractionRepository;

    public ReviewController(ReviewRepository repository, UserAccountRepository userRepository, AttractionRepository attractionRepository) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.attractionRepository = attractionRepository;
    }

    @GetMapping
    public List<Review> list(@RequestParam(required = false) Long attractionId) {
        if (attractionId != null) return repository.findByAttractionId(attractionId);
        return repository.findAll();
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody ReviewRequest request) {
        Long userId = request.userId != null ? request.userId : request.user != null ? request.user.getId() : null;
        Long attractionId = request.attractionId != null ? request.attractionId : request.attraction != null ? request.attraction.getId() : null;
        if (userId == null || attractionId == null) {
            return ResponseEntity.badRequest().body("User and attraction ids are required.");
        }
        int rating = request.rating != null ? request.rating : 0;
        if (rating < 1 || rating > 5) return ResponseEntity.badRequest().body("Rating must be between 1 and 5.");

        UserAccount user = userRepository.findById(userId).orElse(null);
        Attraction attraction = attractionRepository.findById(attractionId).orElse(null);
        if (user == null || attraction == null) return ResponseEntity.badRequest().body("User or attraction not found.");

        Review review = new Review();
        review.setUser(user);
        review.setAttraction(attraction);
        review.setRating(rating);
        review.setComment(request.comment);
        review.setCreatedAt(LocalDateTime.now());
        return ResponseEntity.ok(repository.save(review));
    }

    public static class ReviewRequest {
        public Long userId;
        public Long attractionId;
        public Integer rating;
        public String comment;
        public UserAccount user;
        public Attraction attraction;
    }
}
