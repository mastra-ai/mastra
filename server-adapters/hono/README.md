# @mastra/hono

Mastra Hono adapter for the server. Use `@mastra/hono` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/hono
```

## Usage

Configure the prerequisites described in the documentation.

```typescript
import { Hono } from 'hono';
import { HonoBindings, HonoVariables, MastraServer } from '@mastra/hono';
import { mastra } from './mastra';

const app = new Hono<{ Bindings: HonoBindings; Variables: HonoVariables }>();
const server = new MastraServer({ app, mastra });

await server.init();

export default app;
```

## Documentation

- [@mastra/hono documentation](https://mastra.ai/docs/server/server-adapters)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/server-adapters/hono/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
