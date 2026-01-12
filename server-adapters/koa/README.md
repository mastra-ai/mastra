# @mastra/koa

Koa server adapter for Mastra, enabling you to run Mastra with the [Koa](https://koajs.com) framework.

## Installation

```bash
npm install @mastra/koa koa koa-bodyparser
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

## Adding Custom Routes

Add routes directly to the Koa app with access to Mastra context:

```typescript
// Routes added after init() have access to Mastra context via ctx.state
app.use(async ctx => {
  if (ctx.path === '/health' && ctx.method === 'GET') {
    const mastraInstance = ctx.state.mastra;
    const agents = Object.keys(mastraInstance.listAgents());
    ctx.body = { status: 'ok', agents };
  }
});
```

## Configuration Options

```typescript
const server = new MastraServer({
  app,
  mastra,
  prefix: '/api/v2', // Route prefix
  openapiPath: '/openapi.json', // OpenAPI spec endpoint
  bodyLimitOptions: {
    maxSize: 10 * 1024 * 1024, // 10MB
    onError: err => ({ error: 'Payload too large' }),
  },
  streamOptions: { redact: true }, // Redact sensitive data from streams
});
```

## Context Variables

Access these in route handlers via `ctx.state`:

| Key              | Description                 |
| ---------------- | --------------------------- |
| `mastra`         | Mastra instance             |
| `requestContext` | Request context map         |
| `abortSignal`    | Request cancellation signal |
| `tools`          | Available tools             |

## Related Links

- [Server Adapters Documentation](https://mastra.ai/docs/v1/server-db/server-adapters)
- [Koa Documentation](https://koajs.com)
