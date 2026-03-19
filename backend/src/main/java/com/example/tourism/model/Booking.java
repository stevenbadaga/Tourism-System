package com.example.tourism.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
public class Booking {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    private UserAccount user;

    @ManyToOne
    private Attraction attraction;

    private String serviceType;
    private String serviceName;
    private String provider;
    private String status;
    private Double amountUsd;
    private String confirmationChannel;
    private String ticketNumber;
    private LocalDate date;
    private LocalDateTime createdAt;

    public Booking() {}

    public Booking(UserAccount user, Attraction attraction, LocalDate date) {
        this.user = user;
        this.attraction = attraction;
        this.date = date;
        this.serviceType = "tour";
        this.serviceName = attraction != null ? attraction.getName() : "tour-service";
        this.provider = "Sanderling";
        this.status = "CONFIRMED";
        this.confirmationChannel = "email";
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public UserAccount getUser() { return user; }
    public void setUser(UserAccount user) { this.user = user; }
    public Attraction getAttraction() { return attraction; }
    public void setAttraction(Attraction attraction) { this.attraction = attraction; }
    public String getServiceType() { return serviceType; }
    public void setServiceType(String serviceType) { this.serviceType = serviceType; }
    public String getServiceName() { return serviceName; }
    public void setServiceName(String serviceName) { this.serviceName = serviceName; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Double getAmountUsd() { return amountUsd; }
    public void setAmountUsd(Double amountUsd) { this.amountUsd = amountUsd; }
    public String getConfirmationChannel() { return confirmationChannel; }
    public void setConfirmationChannel(String confirmationChannel) { this.confirmationChannel = confirmationChannel; }
    public String getTicketNumber() { return ticketNumber; }
    public void setTicketNumber(String ticketNumber) { this.ticketNumber = ticketNumber; }
    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
