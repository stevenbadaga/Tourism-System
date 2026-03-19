package com.example.tourism.repository;

import com.example.tourism.model.Itinerary;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ItineraryRepository extends JpaRepository<Itinerary, Long> {
    List<Itinerary> findByUserId(Long userId);
}
