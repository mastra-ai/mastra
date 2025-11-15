# Getting Started - OtelBridge Example

## What We've Built

A Fastify API with PostgreSQL, fully instrumented with OpenTelemetry. All HTTP requests and database queries automatically appear as traces in Jaeger.

## Quick Start

From the repo root:

```bash
# 1. Start Docker services
cd examples/otel-bridge
pnpm docker:up

# 2. Run migrations (creates database tables)
pnpm db:migrate

# 3. Start the dev server
pnpm dev
```

That's it! You should see:
```
✓ OpenTelemetry initialized
✓ Database connected
✓ Server running on http://localhost:3000
✓ Jaeger UI available on http://localhost:16686
```

When done, press `Ctrl+C` and cleanup:
```bash
pnpm docker:down
```

You'll see:
```
✓ Server running on http://localhost:3000
✓ Jaeger UI available on http://localhost:16686
```

## See It In Action

### Make API requests
```bash
# Create a story
curl -X POST http://localhost:3000/api/stories \
  -H "Content-Type: application/json" \
  -d '{"title": "Dragon Tale", "prompt": "A story about dragons"}'

# Get the story (shows DB query spans)
curl http://localhost:3000/api/stories/1

# Create a character (more DB spans)
curl -X POST http://localhost:3000/api/characters \
  -H "Content-Type: application/json" \
  -d '{"storyId": 1, "name": "Smaug", "description": "A dragon"}'
```

### View in Jaeger
1. Open http://localhost:16686
2. Select "story-api" service
3. Click "Find Traces"
4. Each request shows:
   - HTTP handler span
   - Database query spans (PostgreSQL)
   - Total latency & duration breakdown

## What's Next

Once you have traces showing up, we'll add:
- Mastra agent integration
- Story generation with the AI agents
- Agent spans appearing in the same trace
- Demonstrating how otel-bridge joins existing traces

## Stopping Services

```bash
pnpm docker:down    # Stop but keep data
pnpm docker:reset   # Stop and delete everything
```

## Troubleshooting

**Services won't start?**
```bash
pnpm docker:reset
```

**Database connection error?**
```bash
# Check containers are running
docker ps | grep otel-bridge

# Check logs
pnpm docker:logs
```

**Can't access Jaeger?**
- UI: http://localhost:16686
- Spans received: Check "Metrics" or console output

## File Structure

```
src/
├── server.ts          # Fastify app + API routes
├── db.ts              # Database connection setup
├── schema.ts          # Drizzle ORM schema
├── otel.ts            # OpenTelemetry config
└── scripts/
    └── migrate.ts     # Database migrations
```

Everything is set up for OTEL instrumentation:
- `@opentelemetry/instrumentation-fastify` - HTTP spans
- `@opentelemetry/instrumentation-pg` - Database query spans
- `@opentelemetry/exporter-trace-otlp-http` - Sends to Jaeger
