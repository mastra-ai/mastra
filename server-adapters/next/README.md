# @mastra/next

`@mastra/next` exposes a Mastra instance through Next.js App Router route handlers. Use it to serve Mastra's REST, streaming, custom API, MCP, and A2A endpoints from the same serverless deployment as a Next.js application.

## Installation

```bash
npm install @mastra/next
```

## Usage

Create a catch-all App Router route at `app/api/[...mastra]/route.ts`:

```typescript title="app/api/[...mastra]/route.ts"
import { createNextRouteHandler } from '@mastra/next';
import { mastra } from '../../../src/mastra';

export const { GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD } = createNextRouteHandler({
  mastra,
});
```

The route prefix and catch-all location must match. For a route mounted below `/api/mastra`, pass the same prefix:

```typescript
createNextRouteHandler({
  mastra,
  prefix: '/api/mastra',
  tools: { customTool },
});
```

## Documentation

`createNextRouteHandler()` returns handlers for every HTTP method supported by the Mastra server. It initializes the underlying Hono adapter on the first request, so the handler object can be exported synchronously from the route module.

The adapter reads the server configuration from the Mastra instance, including custom API routes, route authentication settings, MCP options, and `bodySizeLimit`. Next.js deployments default to a 4.5 MB request body limit unless the Mastra server configuration overrides it.

Use the `tools` option to register additional server tools that are not already part of the Mastra instance. The `prefix` defaults to `/api` and must correspond to the URL segment before the App Router catch-all parameter.

Authentication and custom route `requiresAuth` settings are forwarded to the shared Mastra Hono server adapter. An in-memory task store backs A2A task operations, so use this adapter with the lifecycle and persistence constraints of the target Next.js hosting environment in mind.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/server-adapters/next/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
