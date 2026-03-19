package com.example.tourism.controller;

import com.example.tourism.model.Attraction;
import com.example.tourism.repository.AttractionRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/attractions")
public class AttractionController {

    private final AttractionRepository repository;

    public AttractionController(AttractionRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<Attraction> list(@RequestParam(required = false) String city) {
        if (city != null) return repository.findByCity(city);
        return repository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Attraction> get(@PathVariable Long id) {
        return repository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Attraction create(@RequestBody Attraction a) {
        return repository.save(a);
    }
}
