# Hono Multi-Service Example

Distributed tracing example demonstrating Mastra's OtelBridge with multiple Hono services and Arize Phoenix.

## Overview

This example demonstrates proper trace context propagation across three services:

```
service-one (port 3000)
    ↓ HTTP request
service-two (port 3001)
    ↓ HTTP request
service-mastra (port 4000) → Mastra agent with OtelBridge
```

All services use OpenTelemetry instrumentation, and traces are visualized in Arize Phoenix.

## Key Demonstration

The **OtelBridge** enables Mastra to:

1. **Read trace context** from incoming HTTP requests (traceparent headers)
2. **Create OTEL spans** for Mastra operations (agent runs, LLM calls)
3. **Maintain trace hierarchy** - all spans share the same trace ID across services

Without OtelBridge, Mastra would create disconnected traces with new trace IDs.

## Prerequisites

- Docker (for Arize Phoenix)
- Node.js >= 20
- pnpm >= 10
- OpenAI API key

## Setup

### 1. Start Arize Phoenix

```bash
pnpm docker:up
```

Phoenix will be available at:

- **UI**: http://localhost:6006
- **OTLP endpoint**: http://localhost:6006/v1/traces

### 2. Configure OpenAI API Key

Create a `.env` file in the example root directory:

```bash
echo "OPENAI_API_KEY=your-key-here" > .env
```

### 3. Install Dependencies

From the example root:

```bash
pnpm install
```

### 4. Build

The shared instrumentation package and the mastra service must be built before testing:

```bash
pnpm build
```

## Running the Services

You need three terminal windows:

**Terminal 1 - service-one:**

```bash
cd observability/_examples/otel-bridge/hono-multi/service-one
pnpm start
```

**Terminal 2 - service-two:**

```bash
cd observability/_examples/otel-bridge/hono-multi/service-two
pnpm start
```

**Terminal 3 - service-mastra:**

```bash
cd observability/_examples/otel-bridge/hono-multi/service-mastra
pnpm start
```

## Testing Trace Propagation

Make a request to service-one:

```bash
curl http://localhost:3000/service-one
```

**Expected response:**

```json
{
  "message": "service-one → service-two → service-mastra (agent: Hello there friend!)"
}
```

## Viewing Traces in Phoenix

1. Open http://localhost:6006
2. You should see a single trace containing all spans from all three services
3. The trace will show:
   - HTTP spans from service-one and service-two
   - Mastra agent span from service-mastra
   - LLM generation spans
   - All sharing the same trace ID

## Architecture Details

### service-one

- Entry point service
- Uses Hono with OTEL auto-instrumentation
- Calls service-two via fetch (automatically instrumented)

### service-two

- Intermediate service
- Receives requests from service-one
- Forwards to service-mastra
- Demonstrates trace context propagation through HTTP

### service-mastra

- Mastra-based service
- Uses **OtelBridge** to integrate with OTEL
- Calls OpenAI via Mastra agent
- Returns trace ID in response

### Shared Instrumentation

All services use a shared instrumentation package that:

- Configures OpenTelemetry SDK
- Auto-instruments HTTP/fetch requests
- Exports traces to Arize Phoenix

## Key Files

- `instrumentation/src/index.ts` - Shared OTEL configuration
- `service-mastra/src/index.ts` - Mastra + OtelBridge setup
- `service-mastra/src/agent.ts` - Simple Mastra agent
- `docker-compose.yml` - Arize Phoenix configuration

## Troubleshooting

### Disconnected traces (different trace IDs)

This indicates a problem with trace context propagation:

1. Verify all services are using the shared instrumentation
2. Check that service-mastra has OtelBridge configured
3. Ensure telemetry is initialized before creating the Hono app

### Agent errors

1. Verify `OPENAI_API_KEY` is set in `.env` (example root directory)
2. Check the OpenAI API is accessible
3. Ensure you have sufficient credits

## Running Integration Tests

The integration tests verify distributed tracing across all three services.

### Prerequisites

1. Phoenix must be running: `pnpm docker:up`
2. OpenAI API key configured (choose one method):
   - **Using .env file** (recommended): Create `.env` in example root with your API key
   - **Using environment variable**: Set `OPENAI_API_KEY=your-key` before running tests
3. Build the shared instrumentation and mastra service: `pnpm build`

### Run Tests

```bash
# If using .env file (recommended)
pnpm test

# Or with inline environment variable
OPENAI_API_KEY=your-key pnpm test
```

### What the Tests Verify

The tests will:

1. Start all three services automatically
2. Make requests through the service chain
3. Verify traces appear in Phoenix with proper context propagation
4. Check parent-child span relationships
5. Clean up all services when done

## Cleanup

Stop Phoenix:

```bash
pnpm docker:down
```

Stop all services: `Ctrl+C` in each terminal

## Comparison to Original Example

This example is based on [treasur-inc/mastra-hono-tracing-example](https://github.com/treasur-inc/mastra-hono-tracing-example) but updated to:

1. **Use Arize Phoenix** (local, open-source) instead of cloud Arize
2. **Include OtelBridge** to fix trace propagation issues
3. **Integrate with Mastra monorepo** using workspace dependencies
4. **Demonstrate the fix** - traces now properly link across all services
