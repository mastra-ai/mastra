# @mastra/tanstack-start

Mastra TanStack Start server adapter — drop your Mastra instance into a TanStack Start app. Use `@mastra/tanstack-start` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/tanstack-start
```

## Usage

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
