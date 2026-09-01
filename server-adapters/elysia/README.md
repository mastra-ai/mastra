# @mastra/elysia

Mastra Elysia adapter for the server. Use `@mastra/elysia` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/elysia
```

## Usage

```typescript
import { Elysia } from 'elysia';
import { MastraServer } from '@mastra/elysia';
import { mastra } from './mastra';

const app = new Elysia();
const server = new MastraServer({ app, mastra });
await server.init();
```

## Documentation

- [@mastra/elysia documentation](https://mastra.ai/docs/server/server-adapters)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/server-adapters/elysia/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
