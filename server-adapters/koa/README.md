# @mastra/koa

Koa server adapter for Mastra, enabling you to run Mastra with the [Koa](https://koajs.com) framework.

## Installation

```bash
npm install @mastra/koa
```

## Usage

```typescript
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { MastraServer } from '@mastra/koa';
import { mastra } from './mastra';

const app = new Koa();
app.use(bodyParser());

const server = new MastraServer({ app, mastra });

await server.init();

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

## Documentation

- [Koa adapter reference](https://mastra.ai/reference/server/koa-adapter)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/server-adapters/koa/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
