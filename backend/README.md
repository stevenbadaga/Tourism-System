# Intelligent Tourism Backend

This backend provides the REST API for attractions, users, preferences, bookings, reviews, itineraries, notifications, authentication, and recommendations.

## Local Run

From the repository root:

```powershell
cd backend
mvn -q -DskipTests package
java -jar target\intelligent-tourism-backend-0.0.1-SNAPSHOT.jar
```

The app runs on `http://localhost:8080`.

## Data Setup

- H2 is used by default for local development
- Sample data is loaded on startup
- PostgreSQL settings can be supplied for Docker or production-style runs

## Main API Areas

- Attractions
- Users
- User preferences
- Bookings
- Reviews
- Itineraries
- Recommendations
- Notifications
- Authentication
