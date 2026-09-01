# @mastra/next

`@mastra/next` exposes a Mastra instance through Next.js App Router route handlers. Use it to serve Mastra's REST and streaming endpoints from the same Next.js deployment as your application.

## Installation

```bash
npm install @mastra/next
```

## Usage

```typescript
import { createNextRouteHandler } from '@mastra/next';
import { mastra } from '../../../mastra';

export const { GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD } = createNextRouteHandler({ mastra });
```

## Documentation

- [@mastra/next documentation](https://mastra.ai/docs/server/server-adapters)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/server-adapters/next/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
