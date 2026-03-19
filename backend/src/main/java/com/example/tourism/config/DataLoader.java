package com.example.tourism.config;

import com.example.tourism.model.Attraction;
import com.example.tourism.model.UserAccount;
import com.example.tourism.repository.AttractionRepository;
import com.example.tourism.repository.UserAccountRepository;
import com.example.tourism.util.HashUtils;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.LocalDateTime;

@Configuration
public class DataLoader {

    @Bean
    CommandLineRunner loadInitial(AttractionRepository attractionRepository, UserAccountRepository userRepository) {
        return args -> {
            if (attractionRepository.count() == 0) {
                attractionRepository.save(new Attraction("Kigali Genocide Memorial","A key historical and educational site","Kigali"));
                attractionRepository.save(new Attraction("Nyungwe Forest Canopy Walk","Rainforest adventure and biodiversity hub","Huye"));
                attractionRepository.save(new Attraction("Lake Kivu Boardwalk","Scenic relaxation and cycling zone","Rubavu"));
                attractionRepository.save(new Attraction("King's Palace Museum","Cultural and heritage experience","Huye"));
                attractionRepository.save(new Attraction("Volcanoes National Park Gate","Wildlife and mountain trekking entry point","Musanze"));
            }
            if (userRepository.count() == 0) {
                UserAccount alice = new UserAccount("alice", "alice@example.com");
                alice.setPasswordHash(HashUtils.sha256("alice123"));
                alice.setRole("tourist");
                alice.setNationality("Rwanda");
                alice.setTravelCompanions(2);
                alice.setCreatedAt(LocalDateTime.now());

                UserAccount bob = new UserAccount("bob", "bob@example.com");
                bob.setPasswordHash(HashUtils.sha256("bob123"));
                bob.setRole("admin");
                bob.setNationality("Kenya");
                bob.setTravelCompanions(1);
                bob.setCreatedAt(LocalDateTime.now());

                userRepository.save(alice);
                userRepository.save(bob);
            }
        };
    }
}
