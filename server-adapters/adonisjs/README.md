# @mastra/adonisjs

AdonisJS server adapter for Mastra, enabling you to run Mastra inside an [AdonisJS](https://adonisjs.com) v6 application.

## Installation

```bash
npm install @mastra/adonisjs
```

## Usage

Register Mastra's routes from your routes file (or any preload file that runs before the router is committed):

```typescript
// start/routes.ts
import app from '@adonisjs/core/services/app';
import router from '@adonisjs/core/services/router';
import { MastraServer } from '@mastra/adonisjs';
import { mastra } from '#mastra/index';

const server = new MastraServer({ app: router, mastra });

await server.init();

app.terminating(() => mastra.shutdown());
```

Mastra's API is now served under `/api` (configurable with `prefix`).

## Documentation

- [AdonisJS adapter reference](https://mastra.ai/reference/server/adonisjs-adapter)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/server-adapters/adonisjs/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
