# @mastra/tanstack-start

`@mastra/tanstack-start` exposes a Mastra instance through TanStack Start server route handlers. Use it to serve Mastra's REST and streaming endpoints from the same TanStack Start application.

## Installation

```bash
npm install @mastra/tanstack-start
```

## Usage

Create a catch-all TanStack Start server route. This example uses `createFileRoute` from `@tanstack/react-router`, which is already present in a TanStack Start application.

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { createStartRouteHandler } from '@mastra/tanstack-start';
import { mastra } from '../../mastra';

export const Route = createFileRoute('/api/$')({
  server: { handlers: createStartRouteHandler({ mastra }) },
});
```

## Documentation

- [@mastra/tanstack-start documentation](https://mastra.ai/docs/server/server-adapters)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/server-adapters/tanstack-start/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
