# @mastra/fastify

Mastra Fastify adapter for the server. Use `@mastra/fastify` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/fastify
```

## Usage

Configure the prerequisites described in the documentation.

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

- [@mastra/fastify documentation](https://mastra.ai/docs/server/server-adapters)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/server-adapters/fastify/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
