# @mastra/fastify

Fastify server adapter for Mastra, enabling you to run Mastra with the [Fastify](https://fastify.dev) framework.

## Installation

```bash
npm install @mastra/fastify
```

## Usage

```typescript
import Fastify from 'fastify';
import { MastraServer } from '@mastra/fastify';
import { mastra } from './mastra';

const app = Fastify({ logger: true });
const server = new MastraServer({ app, mastra });

await server.init();

app.listen({ port: 3000 }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server running on ${address}`);
});
```

## Documentation

- [Fastify adapter reference](https://mastra.ai/reference/server/fastify-adapter)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/server-adapters/fastify/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
