# OpenTelemetry Bridge Example

A Fastify API with PostgreSQL database instrumented with OpenTelemetry, showing traces in Jaeger. This example demonstrates the foundation before adding Mastra integration.

## Quick Start

### 1. Start Docker services
```bash
pnpm docker:up
```

This starts:
- PostgreSQL (localhost:5432)
- Jaeger UI (localhost:16686)

### 2. Install dependencies
```bash
pnpm install
```

### 3. Build and run migrations
```bash
pnpm build
pnpm db:migrate
```

### 4. Start the server
```bash
pnpm dev
```

Server runs on `http://localhost:3000`

## Testing

### Create a story
```bash
curl -X POST http://localhost:3000/api/stories \
  -H "Content-Type: application/json" \
  -d '{
    "title": "The Dragon",
    "prompt": "A story about a dragon"
  }'
```

### Get story by ID
```bash
curl http://localhost:3000/api/stories/1
```

### Create a character
```bash
curl -X POST http://localhost:3000/api/characters \
  -H "Content-Type: application/json" \
  -d '{
    "storyId": 1,
    "name": "Smaug",
    "description": "A fearsome dragon"
  }'
```

### List all stories
```bash
curl http://localhost:3000/api/stories
```

### Update a story
```bash
curl -X PUT http://localhost:3000/api/stories/1 \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Once upon a time..."
  }'
```

## Viewing Traces

1. Open Jaeger UI: http://localhost:16686
2. Select "story-api" from the service dropdown
3. Click "Find Traces"
4. Each API request shows:
   - HTTP handler span
   - Database query spans (auto-instrumented PostgreSQL)
   - Duration and timing information

## Environment Variables

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=stories_db
DB_USER=postgres
DB_PASSWORD=postgres

# OTEL
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
PORT=3000
```

## Commands

```bash
# Docker
pnpm docker:up       # Start all services
pnpm docker:down     # Stop all services
pnpm docker:reset    # Stop, remove volumes, and restart
pnpm docker:logs     # View Docker logs

# Development
pnpm install         # Install dependencies
pnpm build          # Build TypeScript
pnpm dev            # Run in watch mode
pnpm start          # Run compiled version
pnpm type-check     # Check types

# Database
pnpm db:migrate     # Run migrations
```

## Architecture

- **Fastify**: HTTP server with OTEL instrumentation
- **PostgreSQL**: Relational database
- **Drizzle ORM**: Type-safe database queries
- **OpenTelemetry**: Tracing SDK
- **Jaeger**: Trace visualization

## Next Steps

This is the foundation. Next, we'll add:
- Mastra agent integration
- Story generation with OTEL context passing
- Agent trace spans appearing in the same trace as API calls
