# Intelligent Tourism System

Intelligent Tourism System is a full-stack tourism platform for destination discovery, trip planning, booking, recommendations, traveler profiles, notifications, community activity, and admin analytics.

The project combines a React + Vite frontend with a Spring Boot backend. It is set up for local development with an in-memory H2 database and can also run with Docker Compose.

## Highlights

- Browse attractions and destination details
- Build personalized itineraries
- Create bookings and manage traveler flows
- View maps, recommendations, reviews, and notifications
- Manage user profiles, preferences, and authentication flows
- Explore community posts and admin analytics screens

## Stack

### Frontend

- React 18
- Vite 4
- React Router 6
- Tailwind CSS 3

### Backend

- Spring Boot 3
- Spring Data JPA
- H2 for local development
- PostgreSQL-ready Docker setup
- Maven

## Run Locally

### Backend

From the repository root:

```powershell
cd backend
mvn -q -DskipTests package
java -jar target\intelligent-tourism-backend-0.0.1-SNAPSHOT.jar
```

The backend starts on `http://localhost:8080`.

### Frontend

From the repository root:

```powershell
cd frontend
npm install
npm run dev
```

The frontend starts on `http://localhost:5173`.

## Docker

To run the backend with PostgreSQL using Docker Compose:

```powershell
docker compose up --build
```

## Project Layout

```text
backend/
  src/main/java/com/example/tourism/
    config/
    controller/
    model/
    repository/
    service/
    util/
  src/main/resources/
frontend/
  src/
    data/
    pages/
    utils/
docker-compose.yml
README.md
```

## Main Features

### Traveler Experience

- Attraction listing and detail pages
- Reviews and ratings
- Personalized recommendations
- Map view
- Booking center
- Notifications
- Itinerary builder
- Profile and preference management

### Admin and Operations

- Analytics dashboard
- User and booking endpoints
- Notification APIs
- Recommendation APIs

### Community

- Community feed
- Ask-a-local style posts
- Group and messaging UI flows

## API Summary

- `GET /api/attractions`
- `GET /api/attractions/{id}`
- `GET /api/users`
- `POST /api/users`
- `GET /api/bookings`
- `POST /api/bookings`
- `GET /api/reviews`
- `POST /api/reviews`
- `GET /api/recommendations`
- `GET /api/itineraries`
- `POST /api/itineraries`

## Development Notes

- Local development uses the default H2 configuration in `backend/src/main/resources/application.properties`.
- Initial sample data is loaded by `DataLoader`.
- The frontend can point to a different API by setting `VITE_API_BASE`.

## License

This project is licensed under the MIT License. See `LICENSE`.
