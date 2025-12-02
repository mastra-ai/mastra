# MCP Server transport for Hono applications

## Overview

This project provides a transport for Hono application that needs to connect to MCP Server. [An official TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) is designed to be used with `express`.
If you try and follow their instructions but change `express` with `hono`, you will find that it's not going to work. Even if you set `HttpBinding` as an env (see an example from [@hono/node-server](https://github.com/honojs/node-server?tab=readme-ov-file#accessing-nodejs-api)),
it still doesn't work as some headers are being added to a response after it's sent.

This implementation is inspired by the following [pull request](https://github.com/modelcontextprotocol/typescript-sdk/pull/178)

You can use this transport until there is a proper support for Hono in the official SDK.

## Getting started

### Installation

```bash
pnpm add -D hono-mcp-server-sse-transport
```

### Usage

```typescript
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { streamSSE } from 'hono/streaming';
import { SSETransport } from 'hono-mcp-server-sse-transport';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const mcpServer = new McpServer(
  {
    name: 'your-mcp-server-name',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// here you add your tools
// ...

const app = new Hono();

// to support multiple simultaneous connections we have a lookup object from
// sessionId to transport
const transports: { [sessionId: string]: SSETransport } = {};

app.get('/sse', (c) => {
  return streamSSE(c, async (stream) => {
    const transport = new SSETransport('/messages', stream);

    transports[transport.sessionId] = transport;

    stream.onAbort(() => {
      delete transports[transport.sessionId];
    });

    await mcpServer.connect(transport);

    while (true) {
      // This will keep the connection alive
      // You can also await for a promise that never resolves
      await stream.sleep(60_000);
    }
  });
});

app.post('/messages', async (c) => {
  const sessionId = c.req.query('sessionId');
  const transport = transports[sessionId];

  if (transport == null) {
    return c.text('No transport found for sessionId', 400);
  }

  return await transport.handlePostMessage(c);
});

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
);
```
