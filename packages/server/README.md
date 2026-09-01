# @mastra/server

Framework-neutral handlers and server utilities for exposing Mastra agents, workflows, tools, memory, and observability APIs. Install `@mastra/server` to use it in your Mastra application.

## Installation

```bash
npm install @mastra/server
```

## Usage

Import handlers from a supported subpath rather than the package root.

```typescript
import { agents } from '@mastra/server/handlers';

export const listAgentsRoute = agents.LIST_AGENTS_ROUTE;
```

## Documentation

- [@mastra/server documentation](https://mastra.ai/docs/server/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/server/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
