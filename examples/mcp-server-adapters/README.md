# MCP Server Adapters Example

This example demonstrates how to use MCP (Model Context Protocol) server endpoints with both Hono and Express server adapters.

## What This Example Shows

- Setting up MCP servers with tools
- Integrating MCP servers with Mastra
- Using the Hono adapter (`@mastra/hono`)
- Using the Express adapter (`@mastra/express`)
- Testing MCP endpoints via HTTP and SSE transports
- Express.json() middleware compatibility with MCP routes

## Setup

```bash
pnpm install
```

## Running the Servers

### Hono Server (port 3001)

```bash
pnpm start:hono
```

### Express Server (port 3002)

```bash
pnpm start:express
```

## Testing MCP Endpoints

With a server running, run the test script:

```bash
# Test Hono server (default port 3001)
pnpm test:mcp

# Test Express server (port 3002)
pnpm test:mcp -- --port 3002
```

## MCP Endpoints

Each server exposes the following MCP endpoints:

### HTTP Transport

- `POST /api/mcp/{serverId}/mcp` - Stateless HTTP transport for MCP messages

### SSE Transport

- `GET /api/mcp/{serverId}/sse` - Establish SSE connection
- `POST /api/mcp/{serverId}/messages` - Send messages to SSE session

## Available Tools

### Main Server

- `getWeather` - Gets weather for a location
- `calculate` - Performs basic math operations
- `echo` - Echoes back a message

### Secondary Server

- `calculate` - Performs basic math operations

## Using MCPClient

You can connect to these servers using `@mastra/mcp`'s MCPClient:

```typescript
import { MCPClient } from '@mastra/mcp';

const client = new MCPClient({
  servers: {
    main: {
      // Use 'main-mcp' as the serverId (matches the key in Mastra's mcpServers config)
      url: new URL('http://localhost:3001/api/mcp/main-mcp/mcp'),
    },
  },
});

// List available tools
const tools = await client.listTools();

// Execute a tool
const result = await tools['main_calculate'].execute({
  operation: 'multiply',
  a: 6,
  b: 7,
});
```

## Express.json() Compatibility

The Express server demonstrates that MCP routes work correctly even when `express.json()` middleware is applied globally. The server adapter handles both pre-parsed request bodies (from middleware) and raw request streams.
