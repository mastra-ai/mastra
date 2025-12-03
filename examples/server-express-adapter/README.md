# Express Server Adapter Example

This example demonstrates how to use the `@mastra/express` server adapter to run Mastra with [Express](https://expressjs.com).

## What it shows

- Basic server setup with `MastraServer`
- Required `express.json()` middleware for body parsing
- Custom routes added after `init()` with access to Mastra context
- Accessing the Mastra instance via `res.locals`

## Getting started

1. Install dependencies:

```bash
pnpm install
```

2. Copy `.env.example` to `.env` and add your OpenAI API key:

```bash
cp .env.example .env
```

3. Start the server:

```bash
pnpm start
```

## Testing the endpoints

List agents:

```bash
curl http://localhost:4111/api/agents
```

Health check (custom route):

```bash
curl http://localhost:4111/health
```

Generate a response:

```bash
curl -X POST http://localhost:4111/api/agents/assistantAgent/generate \
  -H "Content-Type: application/json" \
  -d '{"messages": "What is 2+2?"}'
```

## Key differences from Hono

- Express requires `express.json()` middleware for JSON body parsing
- Context is accessed via `res.locals` instead of `c.get()`

## Documentation

- [Express Adapter docs](https://mastra.ai/docs/v1/server-db/express-adapter)
- [Server Adapters overview](https://mastra.ai/docs/v1/server-db/server-adapters)
