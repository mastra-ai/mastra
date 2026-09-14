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

- [TanStack Start reference](https://mastra.ai/reference/server/tanstack-start-adapter)
- [Guide](https://mastra.ai/integrations/frameworks/tanstack-start)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/server-adapters/tanstack-start/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
