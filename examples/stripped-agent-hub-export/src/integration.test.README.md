# Integration Test

This integration test verifies that the stripped-agent-hub-export example properly integrates with OpenTelemetry and creates the expected spans in Jaeger.

## Prerequisites

1. **Jaeger Container**: The test requires Jaeger to be running in Docker
2. **OpenAI API Key**: The test requires a valid OpenAI API key to run the agent

## Setup

### 1. Start Jaeger

```bash
# From the example directory
make run-depsonly
```

This starts the Jaeger container on:

- Port 16686: Jaeger UI and API
- Port 4318: OTLP receiver

### 2. Set Environment Variables

Create a `.env` file in the example directory with:

```bash
OPENAI_API_KEY=your-api-key-here
```

Or export the environment variable:

```bash
export OPENAI_API_KEY=your-api-key-here
```

### 3. Install Dependencies

```bash
# From monorepo root
pnpm install

# Or from example directory
npm install
```

## Running the Test

```bash
# From example directory (requires OPENAI_API_KEY in .env file or environment)
npm test

# Or run with API key inline
OPENAI_API_KEY=your-key-here npm test

# Or run with vitest directly
npx vitest run src/integration.test.ts
```

The test will:

- Automatically start the server (using `npm run start:test` - no file watching)
- Run all test cases
- Automatically stop the server when done (whether tests pass or fail)
- Exit when complete

## What the Test Verifies

The integration test verifies:

1. **Server Startup**: The server starts correctly and responds to health checks
2. **HTTP Response**: The `/demo/v1` endpoint returns valid responses
3. **OTEL Span Creation**: Spans are created and exported to Jaeger including:
   - HTTP server spans from auto-instrumentation
   - Mastra agent spans
   - Mastra LLM generation spans
4. **Parent-Child Relationships**: Spans maintain correct parent-child relationships
5. **Trace Context Propagation**: When a `traceparent` header is provided, all spans inherit the trace ID

## Test Architecture

The test:

1. Spawns the server process using `npm run start:test` (without file watching)
2. Waits for the server to start (looks for "Server listening" message)
3. If server fails to start, kills the process and fails the test
4. Makes HTTP requests to the `/demo/v1` endpoint
5. Queries the Jaeger API (`http://localhost:16686/api/traces`) to verify spans
6. Validates span attributes, relationships, and trace IDs
7. Always cleans up the server process on completion (whether tests pass or fail)
   - Tries graceful shutdown first (SIGTERM)
   - Force kills after 5 seconds if needed (SIGKILL)

## Troubleshooting

### Test times out waiting for server

Check that the server can start successfully:

```bash
npm run start:dev
```

### Test can't connect to Jaeger

Verify Jaeger is running:

```bash
docker ps | grep jaeger
curl http://localhost:16686/api/services
```

### No spans found in Jaeger

1. Check that OTEL is configured correctly in `src/core/telemetry/init.ts`
2. Verify the OTLP exporter URL: `http://localhost:4318/v1/traces`
3. Check server logs for OTEL errors

### Agent fails to respond

1. Verify `OPENAI_API_KEY` is set correctly
2. Check server logs for API errors
3. Ensure the OpenAI API is accessible

## Cleanup

Stop Jaeger when done:

```bash
make stop-depsonly
```
