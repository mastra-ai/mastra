# @mastra/tanstack-start

`@mastra/tanstack-start` exposes a Mastra instance through TanStack Start server route handlers. Use it to serve Mastra's REST, streaming, custom API, MCP, and A2A endpoints from the same TanStack Start application.

## Installation

```bash
npm install @mastra/tanstack-start
```

## Usage

Create a catch-all server route at `src/routes/api/$.ts`:

```typescript title="src/routes/api/$.ts"
import { createFileRoute } from '@tanstack/react-router';
import { createStartRouteHandler } from '@mastra/tanstack-start';
import { mastra } from '../../mastra';

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: createStartRouteHandler({ mastra }),
  },
});
```

The route prefix and splat location must match. For a route mounted below `/api/mastra`, pass the same prefix:

```typescript
createStartRouteHandler({
  mastra,
  prefix: '/api/mastra',
  tools: { customTool },
});
```

## Documentation

`createStartRouteHandler()` returns GET, POST, PUT, DELETE, PATCH, OPTIONS, and HEAD handlers compatible with TanStack Start's server route API. It lazily initializes the underlying Hono adapter on the first request and forwards the standard Web `Request` to the Mastra server.

The adapter reads custom API routes, per-route authentication, MCP settings, and `bodySizeLimit` from the Mastra server configuration. Request bodies default to a 4.5 MB limit when no application-specific value is configured.

Use `tools` to register additional server tools. The `prefix` defaults to `/api` and must match the path before the `$` splat route. Authentication and each custom route's `requiresAuth` value are passed to the common Mastra server adapter.

A2A operations use an in-memory task store. Keep the target TanStack Start deployment's process lifecycle in mind when relying on task state across separate requests or replicas.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/server-adapters/tanstack-start/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
