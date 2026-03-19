package com.example.tourism.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
public class Itinerary {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    private UserAccount user;

    private String title;
    private String description;
    private String visibility;
    private String collaborators;
    private LocalDate tripDate;
    private Integer tripLength;
    @Lob
    @Column(columnDefinition = "TEXT")
    private String activitiesJson;
    private LocalDateTime createdAt;

    public Itinerary() {}
    public Itinerary(UserAccount user, String title, String description) {
        this.user = user;
        this.title = title;
        this.description = description;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public UserAccount getUser() { return user; }
    public void setUser(UserAccount user) { this.user = user; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getVisibility() { return visibility; }
    public void setVisibility(String visibility) { this.visibility = visibility; }
    public String getCollaborators() { return collaborators; }
    public void setCollaborators(String collaborators) { this.collaborators = collaborators; }
    public LocalDate getTripDate() { return tripDate; }
    public void setTripDate(LocalDate tripDate) { this.tripDate = tripDate; }
    public Integer getTripLength() { return tripLength; }
    public void setTripLength(Integer tripLength) { this.tripLength = tripLength; }
    public String getActivitiesJson() { return activitiesJson; }
    public void setActivitiesJson(String activitiesJson) { this.activitiesJson = activitiesJson; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
