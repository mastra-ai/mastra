# @mastra/express

Express server adapter for Mastra, enabling you to run Mastra with the [Express](https://expressjs.com) framework.

## Installation

```bash
npm install @mastra/express
```

## Usage

```typescript
import express from 'express';
import { MastraServer } from '@mastra/express';
import { mastra } from './mastra';

const app = express();
const server = new MastraServer({ app, mastra });

await server.init();

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

## Documentation

- [Express adapter reference](https://mastra.ai/reference/server/express-adapter)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/server-adapters/express/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
