package com.example.tourism.service;

import com.example.tourism.model.Attraction;
import com.example.tourism.repository.AttractionRepository;
import com.example.tourism.repository.BookingRepository;
import com.example.tourism.repository.ReviewRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class RecommendationService {

    private final AttractionRepository attractionRepository;
    private final BookingRepository bookingRepository;
    private final ReviewRepository reviewRepository;

    public RecommendationService(AttractionRepository attractionRepository, BookingRepository bookingRepository, ReviewRepository reviewRepository) {
        this.attractionRepository = attractionRepository;
        this.bookingRepository = bookingRepository;
        this.reviewRepository = reviewRepository;
    }

    public List<Attraction> recommendByCity(String city) {
        String requestedCity = city != null ? city.trim() : "";
        List<Attraction> all = attractionRepository.findAll();

        List<Attraction> candidates = all;
        if (!requestedCity.isBlank()) {
            String normalizedCity = requestedCity.toLowerCase(Locale.ROOT);
            candidates = all.stream()
                    .filter(item -> item.getCity() != null && item.getCity().toLowerCase(Locale.ROOT).equals(normalizedCity))
                    .toList();
            if (candidates.isEmpty()) {
                candidates = all;
            }
        }

        Map<Long, Long> activeBookingsByAttraction = bookingRepository.findAll().stream()
                .filter(booking -> booking.getAttraction() != null && !Objects.equals("CANCELLED", String.valueOf(booking.getStatus()).toUpperCase(Locale.ROOT)))
                .collect(Collectors.groupingBy(
                        booking -> booking.getAttraction().getId(),
                        Collectors.counting()
                ));

        Map<Long, List<Integer>> ratingsByAttraction = reviewRepository.findAll().stream()
                .filter(review -> review.getAttraction() != null)
                .collect(Collectors.groupingBy(
                        review -> review.getAttraction().getId(),
                        Collectors.mapping(review -> review.getRating(), Collectors.toList())
                ));

        return candidates.stream()
                .sorted((left, right) -> Double.compare(
                        score(right, activeBookingsByAttraction, ratingsByAttraction),
                        score(left, activeBookingsByAttraction, ratingsByAttraction)
                ))
                .limit(8)
                .toList();
    }

    private double score(Attraction attraction, Map<Long, Long> bookingsByAttraction, Map<Long, List<Integer>> ratingsByAttraction) {
        long attractionId = attraction.getId() != null ? attraction.getId() : -1L;
        long bookingCount = bookingsByAttraction.getOrDefault(attractionId, 0L);
        List<Integer> ratings = ratingsByAttraction.getOrDefault(attractionId, List.of());
        double averageRating = ratings.isEmpty()
                ? 0d
                : ratings.stream().mapToInt(Integer::intValue).average().orElse(0d);
        double reviewVolumeBoost = Math.min(2.0, ratings.size() * 0.15);
        return bookingCount * 1.4 + averageRating * 2.8 + reviewVolumeBoost;
    }
}
