package com.example.tourism.controller;

import com.example.tourism.model.Attraction;
import com.example.tourism.model.Booking;
import com.example.tourism.model.UserAccount;
import com.example.tourism.repository.AttractionRepository;
import com.example.tourism.repository.BookingRepository;
import com.example.tourism.repository.UserAccountRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@RestController
@RequestMapping("/api/bookings")
public class BookingController {

    private final BookingRepository bookingRepository;
    private final UserAccountRepository userRepository;
    private final AttractionRepository attractionRepository;

    public BookingController(BookingRepository bookingRepository, UserAccountRepository userRepository, AttractionRepository attractionRepository) {
        this.bookingRepository = bookingRepository;
        this.userRepository = userRepository;
        this.attractionRepository = attractionRepository;
    }

    @GetMapping
    public List<Booking> list(@RequestParam(required = false) Long userId) {
        if (userId != null) return bookingRepository.findByUserId(userId);
        return bookingRepository.findAll();
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody BookingRequest req) {
        if (req == null || req.userId == null) return ResponseEntity.badRequest().body("User id is required");
        UserAccount user = userRepository.findById(req.userId).orElse(null);
        if (user == null) return ResponseEntity.badRequest().body("Invalid user id");

        Attraction attraction = null;
        if (req.attractionId != null) {
            attraction = attractionRepository.findById(req.attractionId).orElse(null);
            if (attraction == null) return ResponseEntity.badRequest().body("Invalid attraction id");
        }

        Booking booking = new Booking();
        booking.setUser(user);
        booking.setAttraction(attraction);
        booking.setDate(req.date != null ? req.date : LocalDate.now());
        booking.setServiceType(req.serviceType != null ? req.serviceType.toLowerCase(Locale.ROOT) : "tour");
        booking.setServiceName(req.serviceName != null ? req.serviceName : attraction != null ? attraction.getName() : "service");
        booking.setProvider(req.provider != null ? req.provider : "Sanderling");
        booking.setStatus(req.status != null ? req.status : "CONFIRMED");
        booking.setAmountUsd(req.amountUsd != null ? req.amountUsd : 0d);
        booking.setConfirmationChannel(req.confirmationChannel != null ? req.confirmationChannel : "email");
        booking.setTicketNumber(req.ticketNumber != null ? req.ticketNumber : generateTicket());
        booking.setCreatedAt(LocalDateTime.now());

        return ResponseEntity.ok(bookingRepository.save(booking));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody BookingUpdateRequest req) {
        return bookingRepository.findById(id)
                .map(existing -> {
                    if (req.date != null) existing.setDate(req.date);
                    if (req.status != null) existing.setStatus(req.status);
                    if (req.confirmationChannel != null) existing.setConfirmationChannel(req.confirmationChannel);
                    return ResponseEntity.ok(bookingRepository.save(existing));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> cancel(@PathVariable Long id) {
        return bookingRepository.findById(id)
                .map(existing -> {
                    existing.setStatus("CANCELLED");
                    bookingRepository.save(existing);
                    return ResponseEntity.ok(existing);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    private String generateTicket() {
        String token = UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase(Locale.ROOT);
        return "ETK-" + token;
    }

    public static class BookingRequest {
        public Long userId;
        public Long attractionId;
        public LocalDate date;
        public String serviceType;
        public String serviceName;
        public String provider;
        public String status;
        public Double amountUsd;
        public String confirmationChannel;
        public String ticketNumber;
    }

    public static class BookingUpdateRequest {
        public LocalDate date;
        public String status;
        public String confirmationChannel;
    }
}
