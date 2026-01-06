# Koa Server Adapter Example

This example demonstrates how to use the `@mastra/koa` server adapter to run Mastra with [Koa](https://koajs.com).

## What it shows

- Basic server setup with `MastraServer`
- Required `koa-bodyparser` middleware for JSON body parsing
- Custom routes added after `init()` with access to Mastra context
- Accessing the Mastra instance via `ctx.state.mastra`

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

## Key differences from Express/Hono

- Koa requires `koa-bodyparser` middleware for JSON body parsing
- Context is accessed via `ctx.state.mastra` (Koa state pattern)
- Custom routes use Koa middleware pattern with path matching

## Documentation

- [Server Adapters overview](https://mastra.ai/docs/v1/server-db/server-adapters)
