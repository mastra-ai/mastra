# @mastra/elysia

`@mastra/elysia` mounts Mastra's agent, workflow, tool, memory, and streaming APIs on an Elysia application. Use it when Elysia is already your HTTP server and you want Mastra endpoints in the same process.

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

- [Reference: Elysia adapter](https://mastra.ai/reference/server/elysia-adapter)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/server-adapters/elysia/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
