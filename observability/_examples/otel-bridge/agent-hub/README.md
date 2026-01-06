# Agent Hub Example

Example Fastify server demonstrating Mastra's OpenTelemetry bridge integration with Jaeger tracing.

## Prerequisites

- Docker (for Jaeger)
- OpenAI API key

## Setup

### 1. Start Jaeger

```bash
pnpm docker:up
```

This starts Jaeger on:

- Port 16686: UI and API (http://localhost:16686)
- Port 4318: OTLP receiver

### 2. Configure OpenAI API Key

Create a `.env` file:

```bash
OPENAI_API_KEY=your-api-key-here
```

### 3. Install Dependencies

From the monorepo root:

```bash
pnpm install
```

## Running the Server

Start the development server:

```bash
pnpm start:dev
```

The server runs on http://localhost:8080 with these endpoints:

- `POST /demo/v1` - Agent demo endpoint
- `GET /ping` - Health check

### Example Request

```bash
curl --request POST \
  --url http://localhost:8080/demo/v1 \
  --header 'Content-Type: application/json' \
  --data '{"message": "hello"}'
```

View traces in the Jaeger UI at http://localhost:16686

## Running Tests

The integration tests verify OTEL bridge functionality and trace propagation:

```bash
# Using .env file
pnpm test

# Or with inline environment variable
OPENAI_API_KEY=your-key pnpm test
```

Tests automatically:

- Start the server with OTEL instrumentation
- Make requests and verify spans in Jaeger
- Check parent-child span relationships
- Validate trace context propagation
- Clean up the server process

### What the Tests Verify

1. Server health checks
2. Agent endpoint responses
3. OTEL span creation (HTTP, agent, LLM spans)
4. Correct parent-child span relationships
5. Trace context propagation via `traceparent` header

## Troubleshooting

### Server won't start

Check if port 8080 is in use:

```bash
lsof -i:8080
```

### No spans in Jaeger

Verify Jaeger is running:

```bash
docker ps | grep jaeger
curl http://localhost:16686/api/services
```

### Agent errors

Check your OpenAI API key is valid and has sufficient credits.

## Cleanup

Stop Jaeger:

```bash
pnpm docker:down
```
