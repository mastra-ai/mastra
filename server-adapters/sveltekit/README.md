# @mastra/sveltekit

`@mastra/sveltekit` exposes a Mastra instance through SvelteKit server route handlers. Use it to serve Mastra's REST, streaming, MCP, and A2A endpoints from the same SvelteKit application.

## Installation

```bash
npm install @mastra/sveltekit hono
```

## Usage

Create a catch-all server route at `src/routes/api/[...path]/+server.ts`:

```typescript title="src/routes/api/[...path]/+server.ts"
import { createSvelteKitRouteHandler } from '@mastra/sveltekit';
import { mastra } from '$lib/server/mastra';

export const { GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD } = createSvelteKitRouteHandler({ mastra });
```

The route prefix and the rest parameter location must match. For a route mounted below `/api/mastra`, pass the same prefix:

```typescript
createSvelteKitRouteHandler({
  mastra,
  prefix: '/api/mastra',
  tools: { customTool },
});
```

## Documentation

- [SvelteKit reference](https://mastra.ai/reference/server/sveltekit-adapter)
- [Guide](https://mastra.ai/integrations/frameworks/sveltekit)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/server-adapters/sveltekit/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
