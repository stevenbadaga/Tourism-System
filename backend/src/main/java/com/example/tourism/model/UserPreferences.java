package com.example.tourism.model;

import jakarta.persistence.*;

@Entity
public class UserPreferences {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    private UserAccount user;

    private String interests; // Example: hiking, history, wildlife
    private String preferences; // Example: adventure, culture, relaxation
    private String budgetRange; // Example: economy, mid-range, luxury
    private String accessibility; // Example: mobility, dietary, language
    private String nationality;

    public UserPreferences() {}
    public UserPreferences(UserAccount user) {
        this.user = user;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public UserAccount getUser() { return user; }
    public void setUser(UserAccount user) { this.user = user; }
    public String getInterests() { return interests; }
    public void setInterests(String interests) { this.interests = interests; }
    public String getPreferences() { return preferences; }
    public void setPreferences(String preferences) { this.preferences = preferences; }
    public String getBudgetRange() { return budgetRange; }
    public void setBudgetRange(String budgetRange) { this.budgetRange = budgetRange; }
    public String getAccessibility() { return accessibility; }
    public void setAccessibility(String accessibility) { this.accessibility = accessibility; }
    public String getNationality() { return nationality; }
    public void setNationality(String nationality) { this.nationality = nationality; }
}
