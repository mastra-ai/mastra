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

- [Next.js reference](https://mastra.ai/reference/server/next-adapter)
- [Guide](https://mastra.ai/integrations/frameworks/next-js)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/server-adapters/next/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
