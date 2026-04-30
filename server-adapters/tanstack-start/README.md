# @mastra/tanstack-start

TanStack Start server adapter for Mastra.

This adapter wraps `@mastra/hono` and gives you handlers that plug directly into TanStack Start server routes.

## Installation

```bash
npm install @mastra/tanstack-start
```

## Usage

```typescript
// src/server/mastra-app.ts
import { MastraServer } from '@mastra/tanstack-start';
import { mastra } from './mastra';

const server = new MastraServer({ mastra });
await server.init();

export { server };
```

```typescript
// src/routes/api/$.ts
import { createFileRoute } from '@tanstack/react-router';
import { server } from '../../server/mastra-app';

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: server.createRouteHandlers(),
  },
});
```

If you only want to handle a subset of methods:

```typescript
const handlers = server.createRouteHandlers(['GET', 'POST']);
```

## Why this adapter

- No manual per-method wiring in TanStack Start route files
- Keeps Mastra setup aligned with existing Hono adapter behavior
- Works with catch-all server routes such as `/api/$`

## Tested capabilities

The adapter test suite covers:

- Core Mastra route integration via TanStack Start-style request forwarding
- `createRouteHandlers()` and `createRequestHandler()` behavior
- MCP registry and MCP transport routes
- Auth helper middleware and RBAC permission enforcement
- HTTP request logging behavior
- Malformed JSON handling and server resiliency
