# @mastra/hono

Hono server adapter for Mastra, enabling you to run Mastra with the [Hono](https://hono.dev) framework.

## Installation

```bash
npm install @mastra/hono hono
```

## Usage

```typescript
import { Hono } from 'hono';
import { HonoBindings, HonoVariables, MastraServer } from '@mastra/hono';
import { mastra } from './mastra';

const app = new Hono<{ Bindings: HonoBindings; Variables: HonoVariables }>();
const server = new MastraServer({ app, mastra });

await server.init();

export default app;
```

## Adding Custom Routes

Add routes directly to the Hono app with access to Mastra context:

```typescript
// Routes added after init() have access to Mastra context
app.get('/health', c => {
  const mastraInstance = c.get('mastra');
  const agents = Object.keys(mastraInstance.listAgents());
  return c.json({ status: 'ok', agents });
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

Access these in route handlers via `c.get()`:

| Key              | Description                 |
| ---------------- | --------------------------- |
| `mastra`         | Mastra instance             |
| `requestContext` | Request context map         |
| `abortSignal`    | Request cancellation signal |
| `tools`          | Available tools             |

## Related Links

- [Server Adapters Documentation](https://mastra.ai/docs/server/server-adapters)
- [Hono Documentation](https://hono.dev)
