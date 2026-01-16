# @mastra/express

Express server adapter for Mastra, enabling you to run Mastra with the [Express](https://expressjs.com) framework.

## Installation

```bash
npm install @mastra/express express
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

## Adding Custom Routes

Add routes directly to the Express app with access to Mastra context:

```typescript
// Routes added after init() have access to Mastra context
app.get('/health', (req, res) => {
  const mastraInstance = res.locals.mastra;
  const agents = Object.keys(mastraInstance.listAgents());
  res.json({ status: 'ok', agents });
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

Access these in route handlers via `res.locals`:

| Key              | Description                 |
| ---------------- | --------------------------- |
| `mastra`         | Mastra instance             |
| `requestContext` | Request context map         |
| `abortSignal`    | Request cancellation signal |
| `tools`          | Available tools             |

## Related Links

- [Server Adapters Documentation](https://mastra.ai/docs/v1/server/server-adapters)
- [Express Documentation](https://expressjs.com)
