package com.example.tourism.controller;

import com.example.tourism.model.Booking;
import com.example.tourism.model.Review;
import com.example.tourism.repository.BookingRepository;
import com.example.tourism.repository.ReviewRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Month;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final BookingRepository bookingRepository;
    private final ReviewRepository reviewRepository;

    public NotificationController(BookingRepository bookingRepository, ReviewRepository reviewRepository) {
        this.bookingRepository = bookingRepository;
        this.reviewRepository = reviewRepository;
    }

    @GetMapping
    public List<Map<String, Object>> alerts(
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng,
            @RequestParam(required = false) String types
    ) {
        Set<String> typeFilter = types == null || types.isBlank()
                ? Set.of()
                : Set.of(types.toLowerCase(Locale.ROOT).split(","));

        List<Map<String, Object>> all = new ArrayList<>();
        all.addAll(buildDemandSignals());
        all.addAll(buildQualitySignals());
        all.add(build(
                "emergency",
                "high",
                "Emergency support channel active",
                "For urgent assistance contact the tourism emergency desk."
        ));

        if (all.size() <= 1) {
            all.add(build(
                    "events",
                    "low",
                    "No major disruption signals",
                    "Operational indicators are stable across current destinations."
            ));
        }

        if (lat != null && lng != null) {
            Map<String, Object> localized = build(
                    "traffic",
                    "medium",
                    "Localized route context",
                    "Nearby transfers appear stable for current geolocation."
            );
            localized.put("lat", lat);
            localized.put("lng", lng);
            all.add(0, localized);
        }

        List<Map<String, Object>> filtered = all;
        if (!typeFilter.isEmpty()) {
            filtered = all.stream()
                    .filter(item -> typeFilter.contains(String.valueOf(item.get("type")).toLowerCase(Locale.ROOT)))
                    .toList();
        }

        return filtered.stream()
                .sorted((left, right) -> Integer.compare(priorityOf(String.valueOf(right.get("level"))), priorityOf(String.valueOf(left.get("level")))))
                .toList();
    }

    @GetMapping("/forecast")
    public List<Map<String, String>> forecast() {
        Month month = LocalDate.now().getMonth();
        boolean rainySeason = month == Month.MARCH || month == Month.APRIL || month == Month.MAY
                || month == Month.OCTOBER || month == Month.NOVEMBER;

        if (rainySeason) {
            return List.of(
                    Map.of("day", "Today", "summary", "23 C, scattered rain", "advisory", "Prioritize indoor museums and shorter transfer windows."),
                    Map.of("day", "Tomorrow", "summary", "24 C, intermittent showers", "advisory", "Keep flexible plans and include covered attractions."),
                    Map.of("day", "Day 3", "summary", "22 C, moderate rain", "advisory", "Allow extra travel time between destinations.")
            );
        }

        return List.of(
                Map.of("day", "Today", "summary", "26 C, partly cloudy", "advisory", "Strong day for mixed city and outdoor routes."),
                Map.of("day", "Tomorrow", "summary", "27 C, clear intervals", "advisory", "Good conditions for parks, trails, and viewpoints."),
                Map.of("day", "Day 3", "summary", "25 C, light cloud cover", "advisory", "Maintain hydration and midday shade breaks.")
        );
    }

    private List<Map<String, Object>> buildDemandSignals() {
        LocalDate today = LocalDate.now();
        LocalDate horizon = today.plusDays(7);

        List<Booking> upcoming = bookingRepository.findAll().stream()
                .filter(booking -> booking.getDate() != null)
                .filter(booking -> !String.valueOf(booking.getStatus()).equalsIgnoreCase("CANCELLED"))
                .filter(booking -> !booking.getDate().isBefore(today) && !booking.getDate().isAfter(horizon))
                .toList();

        if (upcoming.isEmpty()) {
            return List.of();
        }

        Map<String, Long> cityDemand = upcoming.stream()
                .map(booking -> booking.getAttraction() != null ? booking.getAttraction().getCity() : null)
                .filter(city -> city != null && !city.isBlank())
                .collect(Collectors.groupingBy(city -> city, Collectors.counting()));

        if (cityDemand.isEmpty()) {
            return List.of(build(
                    "events",
                    "low",
                    "Bookings active this week",
                    "Upcoming service demand is being monitored for itinerary adjustments."
            ));
        }

        Map.Entry<String, Long> peak = cityDemand.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .orElse(null);
        if (peak == null) return List.of();

        String level = peak.getValue() >= 5 ? "high" : peak.getValue() >= 3 ? "medium" : "low";
        return List.of(build(
                "traffic",
                level,
                "Demand concentration in " + peak.getKey(),
                "Upcoming bookings indicate " + peak.getValue() + " active trip(s) in the next 7 days."
        ));
    }

    private List<Map<String, Object>> buildQualitySignals() {
        List<Review> reviews = reviewRepository.findAll();
        if (reviews.isEmpty()) return List.of();

        Map<Long, List<Review>> byAttraction = reviews.stream()
                .filter(review -> review.getAttraction() != null && review.getAttraction().getId() != null)
                .collect(Collectors.groupingBy(review -> review.getAttraction().getId()));

        Map.Entry<Long, List<Review>> lowest = byAttraction.entrySet().stream()
                .filter(entry -> entry.getValue().size() >= 2)
                .min((left, right) -> Double.compare(avgRating(left.getValue()), avgRating(right.getValue())))
                .orElse(null);

        if (lowest == null) return List.of();

        List<Review> bucket = lowest.getValue();
        double avg = avgRating(bucket);
        if (avg >= 3.4) return List.of();

        String attractionName = bucket.get(0).getAttraction() != null
                ? bucket.get(0).getAttraction().getName()
                : "a destination";

        return List.of(build(
                "safety",
                avg < 2.6 ? "high" : "medium",
                "Visitor satisfaction watch",
                String.format(Locale.ROOT, "%s currently averages %.1f/5 from recent reviews.", attractionName, avg)
        ));
    }

    private double avgRating(List<Review> reviews) {
        return reviews.stream()
                .mapToInt(review -> review.getRating())
                .average()
                .orElse(0d);
    }

    private int priorityOf(String level) {
        String normalized = level == null ? "" : level.toLowerCase(Locale.ROOT);
        if ("high".equals(normalized)) return 3;
        if ("medium".equals(normalized)) return 2;
        return 1;
    }

    private Map<String, Object> build(String type, String level, String title, String detail) {
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("id", type + "-" + Math.abs((title + "-" + detail).hashCode()));
        entry.put("type", type);
        entry.put("level", level);
        entry.put("title", title);
        entry.put("detail", detail);
        entry.put("timestamp", LocalDateTime.now());
        return entry;
    }
}
