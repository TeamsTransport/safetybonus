
# DriverSafetyBonus

A full‑stack system to manage driver safety, fleet assignments, and monthly bonus scorecards. The app consists of a **React** frontend and a **Go + MariaDB** backend running locally via **Docker Compose**. Dates/times are normalized to **Winnipeg (America/Winnipeg)**.

---

## Architecture

```
frontend (React/Vite)
  └── talks to /api via fetch
backend (Go + Gin)
  ├── REST endpoints (see API)
  ├── CORS restricted to http://localhost:3000
  ├── Healthcheck /api/healthz
  ├── OpenAPI JSON /openapi.json + swagger UI /swagger
  └── MariaDB (driver_safety)
```

**Key Backend Files**
- `main.go`: server setup, CORS, routes, healthcheck, OpenAPI/Swagger handlers
- `handlers.go`: CRUD & business endpoints (drivers, trucks, safety events, scorecards)
- `models.go`: JSON‑aligned DTOs used by handlers
- `db/init.sql`: schema + seed data for the `driver_safety` database
- `go.mod`: module and dependencies
- `Dockerfile`: multi‑stage image, tzdata, healthcheck

**Key Frontend Files** (selected)
- `services/dbStore.ts`: typed HTTP client used by pages
- `pages/*`: UI for Dashboard, Drivers, Trucks, Safety Events, Scorecards, and setup pages

---

## Prerequisites

- Docker Desktop (or compatible engine)
- Node.js (if you plan to run/build the frontend locally)

---

## Getting Started (Local, with Docker)

1. **Clone your repository** and ensure this folder structure:
   ```
   /frontend         # React app
   /backend          # Go API
   /db/init.sql      # MariaDB schema & seeds
   docker-compose.yml
   ```

2. **Verify docker-compose** points API to the `driver_safety` DB:
   ```yaml
   services:
     db:
       image: mariadb:10.6
       environment:
         MARIADB_ROOT_PASSWORD: root_password
         MARIADB_DATABASE: driver_safety
         MARIADB_USER: safety_user
         MARIADB_PASSWORD: safety_password
       volumes:
         - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
     backend:
       environment:
         DB_DSN: "safety_user:safety_password@tcp(db:3306)/driver_safety?parseTime=true"
         API_PORT: "8080"
     frontend:
       # serves the built UI on port 3000
   ```

3. **Build & start**:
   ```bash
   docker compose up -d --build
   ```

4. **Check health**:
   - API health: `http://localhost:8080/api/healthz`
   - Swagger UI: `http://localhost:8080/swagger`

5. **Open the app**:
   - Frontend (Nginx or Vite preview, per your compose): `http://localhost:3000`

---

## Environment & Configuration

- **Timezone**: The API sets `TZ=America/Winnipeg` and converts all inbound/outbound dates to local date strings (YYYY‑MM‑DD). Database `DATE`/`DATETIME` fields are stored in local semantic form.
- **CORS**: Restricted to `http://localhost:3000`. Adjust in `main.go` if needed.
- **Database**: `driver_safety` schema is provisioned by `db/init.sql` with idempotent seeds.
- **Ports**: API default `8080`, Frontend default `3000`, DB `3306`.

---

## API Overview

> Base path: `/api`

### Common
- `GET /api/healthz` — Healthcheck
- `GET /openapi.json` — OpenAPI spec
- `GET /swagger` — Swagger UI
- `GET /api/bootstrap` — One‑shot hydration for initial page load

### Drivers
- `GET /api/drivers`
- `POST /api/drivers`
- `PUT /api/drivers/:id`
- `DELETE /api/drivers/:id`
- `GET /api/drivers/:id/stats` — events count + bonus/PI aggregates

### Driver Types
- `GET /api/driver-types`
- `POST /api/driver-types`
- `PUT /api/driver-types/:id`
- `DELETE /api/driver-types/:id`

### Trucks
- `GET /api/trucks`
- `POST /api/trucks`
- `PUT /api/trucks/:id`
- `DELETE /api/trucks/:id`
- `GET /api/trucks/:id/history`
- `POST /api/trucks/:id/assign-driver` — link/unlink driver; logs history

### Safety Categories
- `GET /api/safety-categories`
- `POST /api/safety-categories`
- `PUT /api/safety-categories/:id`
- `DELETE /api/safety-categories/:id`

### Scorecard Metrics (Items)
- `GET /api/scorecard-metrics`
- `POST /api/scorecard-metrics`
- `PUT /api/scorecard-metrics/:id`
- `DELETE /api/scorecard-metrics/:id`

### Safety Events
- `GET /api/safety-events`
- `POST /api/safety-events`
- `PUT /api/safety-events/:id`
- `DELETE /api/safety-events/:id`

### Scorecard Events
- `GET /api/scorecard-events`
- `POST /api/scorecard-events`
- `PUT /api/scorecard-events/:id`
- `DELETE /api/scorecard-events/:id`
- `DELETE /api/scorecard-events?driverId={id}&datePrefix={YYYY|YYYY-MM|YYYY-MM-DD}&category={SAFETY|MAINTENANCE|DISPATCH}` — bulk delete for a period/category

---

## Data Contracts (JSON)

All response/request bodies conform to the UI types in `frontend/src/types.ts`. Examples:

```jsonc
// Driver
{
  "driver_id": 1,
  "driver_code": "D0001",
  "first_name": "Alex",
  "last_name": "Smith",
  "start_date": "2026-01-01", // local date
  "truck_id": 10,
  "driver_type_id": 2,
  "profile_pic": "data:image/png;base64,..."
}
```

```jsonc
// SafetyEvent
{
  "safety_event_id": 42,
  "driver_id": 1,
  "event_date": "2026-01-05", // local date
  "category_id": 3,
  "notes": "Level 2 inspection passed",
  "bonus_score": -2,
  "p_i_score": -2,
  "bonus_period": true
}
```

---

## Development Tips

- **Hot reload (frontend)**: run `npm run dev` (Vite) inside `/frontend` for live editing. Ensure API CORS allows `http://localhost:3000`.
- **API rebuild**: editing Go code requires rebuilding the container or running locally: `go run ./main.go` with `DB_DSN` set.
- **Logs**: Gin logger outputs concise request logs; use `docker logs safe-drive-api` to inspect.

---

## Testing & Validation (Optional)

- Add `*_test.go` files for handler functions, using a test DB or a containerized MariaDB service.
- Validate JSON contracts against the OpenAPI spec (`/openapi.json`).

---

## Security Notes

- No authentication is enforced in MVP. If you enable JWT later, wire `Authorization: Bearer` into `dbStore.ts` via `setAuthToken()` and add Gin middleware.
- Database credentials are for local development. Do not use them in production.

---

## Troubleshooting

- **Swagger UI not loading**: Verify the page at `/swagger` and that `/openapi.json` returns JSON. Network blockers or CSP can interfere.
- **CORS errors**: Confirm the app is served from `http://localhost:3000` and the API has the matching origin configured.
- **DB connection**: Ensure compose starts the `db` service first; API retries connection with exponential backoff.

---

## License

Internal project — Teams Transport Inc. © 2026
