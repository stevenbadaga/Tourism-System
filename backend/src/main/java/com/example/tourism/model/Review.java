package com.example.tourism.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
public class Review {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    private Attraction attraction;

    @ManyToOne
    private UserAccount user;

    private int rating;
    private String comment;
    private LocalDateTime createdAt;

    public Review() {}
    public Review(Attraction attraction, UserAccount user, int rating, String comment) {
        this.attraction = attraction;
        this.user = user;
        this.rating = rating;
        this.comment = comment;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Attraction getAttraction() { return attraction; }
    public void setAttraction(Attraction attraction) { this.attraction = attraction; }
    public UserAccount getUser() { return user; }
    public void setUser(UserAccount user) { this.user = user; }
    public int getRating() { return rating; }
    public void setRating(int rating) { this.rating = rating; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
