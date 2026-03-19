# Intelligent Tourism System

A comprehensive full-stack tourism platform with personalized recommendations, itinerary planning, and destination discovery built with React + Vite + Tailwind (frontend) and Spring Boot + PostgreSQL (backend).

## Features

### Core Modules (Implemented)

1. **User Profile & Preferences** - Register, manage preferences, interests, budget, and accessibility needs
2. **Destination Information** - Browse attractions with detailed information and city filtering
3. **Travel Recommendations** - AI-driven personalized attraction suggestions based on preferences
4. **Booking System** - Reserve attractions with date selection and user management
5. **Reviews & Ratings** - Rate and review attractions with star ratings and comments
6. **Trip Planning** - Create and manage itineraries for multi-day trips
7. **Map View** - Interactive map showing attraction locations and details
8. **Real-Time Updates** - Live booking and availability information

## Tech Stack

### Frontend
- **React 18.2** - UI framework
- **Vite 4.5** - Build tool and dev server
- **React Router 6** - Client-side routing
- **Tailwind CSS 3** - Utility-first CSS styling

### Backend
- **Spring Boot 3.1.4** - Java framework
- **Spring Data JPA** - ORM and database abstraction
- **PostgreSQL** - Production database (H2 in-memory for dev)
- **Maven** - Build and dependency management

## Project Structure

```
System/
â”œâ”€â”€ frontend/               # React + Vite frontend
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ pages/         # Page components
â”‚   â”‚   â”œâ”€â”€ api.js         # API client
â”‚   â”‚   â”œâ”€â”€ App.jsx        # Main router
â”‚   â”‚   â””â”€â”€ index.css      # Tailwind CSS
â”‚   â”œâ”€â”€ package.json       # Dependencies
â”‚   â”œâ”€â”€ vite.config.ts     # Vite configuration
â”‚   â”œâ”€â”€ tailwind.config.cjs# Tailwind setup
â”‚   â””â”€â”€ index.html         # HTML entry point
â”‚
â”œâ”€â”€ backend/               # Spring Boot backend
â”‚   â”œâ”€â”€ src/main/java/com/example/tourism/
â”‚   â”‚   â”œâ”€â”€ model/         # JPA entities
â”‚   â”‚   â”œâ”€â”€ repository/    # Data repositories
â”‚   â”‚   â”œâ”€â”€ controller/    # REST API endpoints
â”‚   â”‚   â”œâ”€â”€ service/       # Business logic
â”‚   â”‚   â””â”€â”€ config/        # Configuration & loaders
â”‚   â”œâ”€â”€ pom.xml            # Maven dependencies
â”‚   â”œâ”€â”€ Dockerfile         # Container image
â”‚   â””â”€â”€ README.md          # Backend instructions
â”‚
â”œâ”€â”€ docker-compose.yml     # Orchestrate PostgreSQL + backend
â””â”€â”€ README.md              # This file
```

## Getting Started

### Prerequisites
- **Node.js 18+** and npm
- **Java 17+** and Maven
- **Docker & Docker Compose** (optional, for containerized setup)

### Quick Start (Local Development)

#### 1. Start Backend (H2 In-Memory)

```powershell
cd System\backend
mvn clean package
$env:SPRING_DATASOURCE_URL='jdbc:h2:mem:tourism'
$env:SPRING_DATASOURCE_USERNAME='sa'
$env:SPRING_DATASOURCE_PASSWORD=''
$env:SPRING_JPA_HIBERNATE_DDL_AUTO='create-drop'
java -jar target\intelligent-tourism-backend-0.0.1-SNAPSHOT.jar
```

Backend runs on **http://localhost:8080**

#### 2. Start Frontend

```powershell
cd System\frontend
npm install
npm run dev
```

Frontend runs on **http://localhost:5173**

### Docker Compose Setup (Production-Ready)

Requires Docker and PostgreSQL:

```powershell
cd System
docker-compose up --build
```

- Backend: http://localhost:8080
- PostgreSQL: localhost:5432 (postgres/postgres)

## API Endpoints

### Attractions
- `GET /api/attractions` - List all attractions (optional `city` query param)
- `GET /api/attractions/{id}` - Get attraction details
- `POST /api/attractions` - Create attraction

### Users
- `GET /api/users` - List users
- `GET /api/users/{id}` - Get user details
- `POST /api/users` - Register new user

### Bookings
- `GET /api/bookings` - List bookings (optional `userId` query param)
- `POST /api/bookings` - Create booking

### Reviews
- `GET /api/reviews` - List reviews (optional `attractionId` query param)
- `POST /api/reviews` - Submit review

### User Preferences
- `GET /api/preferences/{userId}` - Get user preferences
- `POST /api/preferences` - Create/update preferences
- `PUT /api/preferences/{userId}` - Update preferences

### Itineraries
- `GET /api/itineraries` - List itineraries (optional `userId` query param)
- `POST /api/itineraries` - Create itinerary

### Recommendations
- `GET /api/recommendations` - Get recommendations (optional `city` query param)

## Frontend Pages

| Route | Description |
|-------|-------------|
| `/` | Home with featured attractions |
| `/attractions` | Browse all attractions with city filter |
| `/attractions/:id` | Attraction details and booking |
| `/attractions/:id/reviews` | View and submit reviews |
| `/recommendations` | Personalized attraction recommendations |
| `/profile` | User profile and preference settings |
| `/dashboard` | User registration |
| `/itineraries` | Trip planning and itinerary builder |
| `/map` | Interactive map view of attractions |

## Database Schema

### Core Entities
- **UserAccount** - Tourist profiles
- **UserPreferences** - Preferences, interests, budget, accessibility
- **Attraction** - Tourist attractions and POIs
- **Booking** - Reservation records
- **Review** - Ratings and comments
- **Itinerary** - Trip plans

## Sample Data

Initial data is seeded on startup:

**Attractions:**
- Kigali Genocide Memorial (Kigali)
- Nyungwe Forest Canopy Walk (Huye)
- Lake Kivu Boardwalk (Rubavu)
- King's Palace Museum (Huye)
- Volcanoes National Park Gate (Musanze)

**Users:**
- alice (alice@example.com)
- bob (bob@example.com)

## Development Notes

### Adding New Features

1. **Backend**: Add model -> repository -> controller -> update DataLoader
2. **Frontend**: Add page component -> update routes in App.jsx -> add API client in api.js

### Testing APIs

Use cURL, Postman, or the frontend UI:

```powershell
# Get attractions
curl http://localhost:8080/api/attractions

# Create attraction
curl -X POST http://localhost:8080/api/attractions `
  -H "Content-Type: application/json" `
  -d '{"name":"Volcanoes","description":"Mountain hiking","city":"Ruhengeri"}'
```

### Common Issues

**Port 8080 already in use:**
```powershell
Get-Process -Name java | Stop-Process -Force
```

**Frontend can't reach backend:**
- Ensure backend is running on localhost:8080
- Check CORS headers (currently open; add Spring Security for production)

## Future Enhancements

- [ ] Authentication & JWT tokens
- [ ] Weather integration
- [ ] Event calendar integration
- [ ] Real-time notifications
- [ ] Payment gateway integration
- [ ] Email confirmations and reminders
- [ ] Social features (follows, messaging)
- [ ] Analytics dashboard (admin)
- [ ] Mobile app (React Native)
- [ ] Advanced recommendation ML model

## License

MIT License - See LICENSE file for details

## Support

For questions or issues, please open a GitHub issue or contact the development team.
