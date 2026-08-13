# Project Guidelines

## Architecture

Direct event-driven system: Node.js API validates and publishes to Kafka; Node.js consumer projects events into PostgreSQL. The API never writes design rows — it only reads projected data.

See [docs/architecture-and-implementation-plan.md](docs/architecture-and-implementation-plan.md) for full design rationale.

```
UI → Node.js API → Kafka (wellbore-designs.events.v1) → Node.js Consumer → PostgreSQL
                                                                                 ↓
                                                                   Node.js Read API ← UI
```

### Key ownership rules

- **Node.js API** owns validation and Kafka event publishing. It reads from PostgreSQL but never writes designs.
- **Node.js consumer** is the sole writer. All inserts/updates to `wellbore_designs` and `milestones` originate here.
- **Kafka** is the event backbone. Topic `wellbore-designs.events.v1`; DLQ `wellbore-designs.events.v1.dlq`.

### Layering (Node.js API)

| Path | Responsibility |
|------|----------------|
| `src/node-api/src/validation.ts` | Zod schemas, domain constants, `deriveStatus` |
| `src/node-api/src/kafka-producer.ts` | Event envelope construction, Kafka publish |
| `src/node-api/src/routes/wellbore-designs.ts` | CRUD + milestone endpoints |
| `src/node-api/src/routes/dashboard.ts` | Dashboard insight analytics endpoints |
| `src/node-api/src/routes/health.ts` | Liveness and readiness probes |
| `src/node-api/src/app.ts` | Express app setup, static files, error handling |
| `src/node-api/src/index.ts` | Server startup, graceful shutdown |

### Event model

Envelope: `eventId`, `eventType`, `eventVersion`, `aggregateType`, `aggregateId`, `aggregateVersion`, `occurredAtUtc`, `correlationId`, `causationId`, `producer`, `data`.  
Types: `WellboreDesignCreated`, `MilestoneRecorded`.  
Schemas: [contracts/](contracts/) (JSON Schema) and [src/node-consumer/src/wellboreDesignContracts.ts](src/node-consumer/src/wellboreDesignContracts.ts) (Zod).

### Idempotency

Consumer uses event IDs and aggregate versions to prevent duplicate or out-of-order writes. Projection + consumer-log inserts run in a single PostgreSQL transaction.

## Build and Test

```powershell
# Node.js API — typecheck and build
Push-Location .\src\node-api
npm install
npm run typecheck
npm run build
Pop-Location

# Node consumer — typecheck, test, build
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

# Terminal 1
Push-Location .\src\node-api; npm run dev

# Terminal 2
Push-Location .\src\node-consumer; npm run dev
```

UI at `http://localhost:5080`. See [README.md](README.md) for example PowerShell commands.

## Conventions

### Node.js API

- Node ≥ 20. TypeScript, Express 4, kafkajs, pg, zod, pino.
- camelCase for module files. Validation uses zod `.strict()` to reject unknown fields.
- Validation errors return `{ title, status: 400, errors: { field: [messages] } }`.
- Kafka failures → 503; duplicate designs → 409; not found → 404.

### Node.js consumer

- Node ≥ 20. TypeScript with Vitest for tests.
- PascalCase for class files, camelCase for module files.
- Retry wrapper (`executeWithRetry`) with exponential backoff for transient failures.
- Schema validation failures → DLQ immediately (attemptCount 1). Processing failures → retry up to 5 times, then DLQ (attemptCount 5).
- DLQ publisher truncates reason to 2000 chars; uses idempotent producer with `acks = -1`.

### Kafka

- Topic naming: `{domain}.{entity}.v{version}` (e.g. `wellbore-designs.events.v1`).
- DLQ topic: append `.dlq` suffix.
- Message key: `wellboreDesignId` (ensures partition ordering per design).
- Manual offset commits; offsets committed even after handler failure to avoid partition blocking.

## Pitfalls

- **Non-default ports**: PostgreSQL `15432`, Kafka `19093`, API `5080`.
- **Eventual consistency**: A successful API response means Kafka accepted the event, not that the projection is visible yet.
- **Kafka topics not auto-created**: The `kafka-init` compose service must succeed, or producers/consumers will fail.
- **PostgreSQL extensions**: Schema requires `pgcrypto` and `pg_trgm`.
- **Env vars**: API uses `DATABASE_URL`, `KAFKA_BROKERS`, `KAFKA_WELLBORE_DESIGN_TOPIC`; Consumer uses `KAFKA_GROUP_ID` additionally.
- **No lint commands**: Only typecheck, test, and build are available.
