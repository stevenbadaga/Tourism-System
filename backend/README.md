# Intelligent Tourism Backend

Minimal Spring Boot backend scaffold with PostgreSQL.

Run with Docker (recommended):

```powershell
cd System
docker-compose up --build
```

Or build locally with Maven:

```powershell
cd backend
mvn package
java -jar target/intelligent-tourism-backend-0.0.1-SNAPSHOT.jar
```

API endpoints:
- `GET /api/attractions` - list attractions (optional `city` query)
- `GET /api/attractions/{id}` - get attraction
- `POST /api/attractions` - create attraction
