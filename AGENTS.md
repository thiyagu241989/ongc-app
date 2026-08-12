# Project Guidelines

## Architecture

Direct event-driven system: C# API validates and publishes to Kafka; Node.js consumer projects events into PostgreSQL. The API never writes project rows — it only reads projected data.

See [docs/architecture-and-implementation-plan.md](docs/architecture-and-implementation-plan.md) for full design rationale.

```
UI → C# API → Kafka (projects.events.v1) → Node.js Consumer → PostgreSQL
                                                                    ↓
                                                          C# Read API ← UI
```

### Key ownership rules

- **C# API** owns validation and Kafka event publishing. It reads projects from PostgreSQL but never writes them.
- **Node.js consumer** is the sole project writer. All inserts/updates to the `projects` table originate here.
- **Kafka** is the event backbone. Topic `projects.events.v1`; DLQ `projects.events.v1.dlq`.

### Layering (.NET)

| Layer | Project | Responsibility |
|-------|---------|----------------|
| Domain | `WellInformation.Domain` | State model, lifecycle rules |
| Application | `WellInformation.Application` | Request/response DTOs, validation, service interfaces |
| Contracts | `WellInformation.Contracts` | Event envelope and payload records |
| Infrastructure | `WellInformation.Infrastructure` | EF Core persistence, Kafka producer |
| API | `WellInformation.Api` | Controllers, startup, HTTP semantics |

### Event model

Envelope: `eventId`, `eventType`, `eventVersion`, `aggregateType`, `aggregateId`, `aggregateVersion`, `occurredAtUtc`, `correlationId`, `causationId`, `producer`, `data`.  
Types: `ProjectCreated`, `ProjectUpdated`, `ProjectDeleted`.  
Schemas: [contracts/](contracts/) (JSON Schema) and [src/node-consumer/src/contracts.ts](src/node-consumer/src/contracts.ts) (Zod).

### Idempotency

Consumer uses event IDs and aggregate versions to prevent duplicate or out-of-order writes. Projection + consumer-log inserts run in a single PostgreSQL transaction.

## Build and Test

```powershell
# .NET — build and test
dotnet test .\src\dotnet\WellInformation.sln --configuration Release

# Node consumer — typecheck, test, build
Push-Location .\src\node-consumer
npm install
npm run typecheck
npm test
npm run build
Pop-Location

# End-to-end (requires running stack)
.\tests\end-to-end\basic-flow.ps1
```

## Run Locally

```powershell
Copy-Item .\.env.example .\.env      # first time only
docker compose up -d                  # PostgreSQL :15432, Kafka :19093

# Terminal 1
dotnet run --project .\src\dotnet\WellInformation.Api --urls http://localhost:5080

# Terminal 2
Push-Location .\src\node-consumer; npm start
```

UI at `http://localhost:5080`. See [README.md](README.md) for example curl/PowerShell commands.

## Conventions

### .NET

- Target `net10.0`; SDK pinned to `10.0.302` in [global.json](global.json).
- PascalCase for files, classes, records, methods. Interface prefix `I` (e.g. `IProjectService`).
- Domain exceptions map to HTTP ProblemDetails in controllers: validation → 400, duplicate code → 409, version conflict → 412, missing `If-Match` → 428, Kafka failure → 503.
- ETag/`If-Match` concurrency is required for update and delete operations.

### Node.js consumer

- Node ≥ 20. TypeScript with Vitest for tests.
- PascalCase for class files, camelCase for module files.
- Retry wrapper (`executeWithRetry`) with exponential backoff for transient failures.
- Schema validation failures → DLQ immediately (attemptCount 1). Processing failures → retry up to 5 times, then DLQ (attemptCount 5).
- DLQ publisher truncates reason to 2000 chars; uses idempotent producer with `acks = -1`.

### Kafka

- Topic naming: `{domain}.{entity}.v{version}` (e.g. `projects.events.v1`).
- DLQ topic: append `.dlq` suffix.
- Message key: `projectId` (ensures partition ordering per project).
- Manual offset commits; offsets committed even after handler failure to avoid partition blocking.

## Pitfalls

- **Non-default ports**: PostgreSQL `15432`, Kafka `19093`, API `5080`.
- **Eventual consistency**: A successful API response means Kafka accepted the event, not that the projection is visible yet.
- **Kafka topics not auto-created**: The `kafka-init` compose service must succeed, or producers/consumers will fail.
- **PostgreSQL extensions**: Schema requires `pgcrypto` and `pg_trgm`.
- **Env var styles differ**: .NET uses `ConnectionStrings__WellInformationDB`; Node uses `KAFKA_BROKERS`.
- **No lint commands**: Only typecheck, test, and build are available.
