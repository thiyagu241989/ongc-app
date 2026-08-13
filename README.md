# Well Information Management Platform

Event-driven wellbore design tracking: a Node.js Express API validates and publishes events to Kafka, a Node.js consumer projects events into PostgreSQL, and the API reads projected data back for the UI.

## Documentation

- [Architecture and implementation plan](docs/architecture-and-implementation-plan.md)
- [WellboreDesignCreated JSON Schema](contracts/wellbore-design-created-v1.schema.json)
- [MilestoneRecorded JSON Schema](contracts/milestone-recorded-v1.schema.json)
- [Database: wellbore designs + milestones](database/002_insight_dashboard_schema.sql)

## Architecture

![Well Information architecture flow](docs/images/architecture-flow.svg)

```text
UI → Node.js API → Kafka (wellbore-designs.events.v1) → Node.js Consumer → PostgreSQL
                                                                                 ↓
                                                                   Node.js Read API ← UI
```

The Node.js API validates requests, publishes events (`WellboreDesignCreated`, `MilestoneRecorded`) to Kafka, and reads projected data from PostgreSQL. The Node.js consumer is the sole writer to the `wellbore_designs` and `milestones` tables.

## Request and Data Flow

- **Create design:** UI → API validates → Kafka publish → Consumer projects → PostgreSQL.
- **Record milestone:** UI → API validates + reads design → Kafka publish → Consumer updates status.
- **Read data:** UI → API → PostgreSQL → UI.
- **Kafka failure:** API returns 503; client retries safely.
- **Duplicate event:** Consumer detects via event ID; skips silently.
- **Poison message:** Consumer retries up to 5×, then routes to DLQ.

## Prerequisites

- Node.js 20 or later
- Docker Desktop with Linux containers

## Build and Test

```powershell
# Node.js API
Push-Location .\src\node-api
npm install
npm run typecheck
npm run build
Pop-Location

# Node.js consumer
Push-Location .\src\node-consumer
npm install
npm run typecheck
npm test
npm run build
Pop-Location
```

## Run Locally

```powershell
Copy-Item .\.env.example .\.env      # first time only
docker compose up -d                  # PostgreSQL :15432, Kafka :19093
```

In separate terminals:

```powershell
# Terminal 1 — API
Push-Location .\src\node-api; npm run dev

# Terminal 2 — Consumer
Push-Location .\src\node-consumer; npm run dev
```

Open `http://localhost:5080` — the UI redirects to the wellbore designs page.

## Example API Calls

Create a wellbore design:

```powershell
$body = @{
    company    = "ONGC"
    project    = "Mumbai High North"
    site       = "MHN Platform A"
    well       = "A-3"
    wellbore   = "A-3 ST1"
    design     = "A-3 ST1 Casing Design"
    ownerName  = "R. Sharma"
    designType = "Standard"
    milestones = @(
        @{ milestoneType = "GnG data received"; occurredAt = "2026-01-10T09:00:00Z" }
    )
} | ConvertTo-Json -Depth 3

Invoke-RestMethod -Method Post `
    -Uri http://localhost:5080/api/v1/wellbore-designs `
    -ContentType application/json `
    -Body $body
```

Record a milestone:

```powershell
$ms = @{ milestoneType = "MDT conducted"; occurredAt = "2026-01-15T14:30:00Z" } | ConvertTo-Json

Invoke-RestMethod -Method Post `
    -Uri http://localhost:5080/api/v1/wellbore-designs/<id>/milestones `
    -ContentType application/json `
    -Body $ms
```

## PostgreSQL Access

```text
Host: localhost
Port: 15432
Database: WellInformationDB
Username: postgres
Password: postgres
```

Tables: `wellbore_designs`, `milestones`, `kafka_consumer_logs`.