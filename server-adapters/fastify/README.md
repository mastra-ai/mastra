# @mastra/fastify

Fastify server adapter for Mastra, enabling you to run Mastra with the [Fastify](https://fastify.dev) framework.

## Installation

```bash
npm install @mastra/fastify fastify
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

## Adding Custom Routes

Add routes directly to the Fastify app with access to Mastra context:

```typescript
// Routes added after init() have access to Mastra context
app.get('/health', async request => {
  const mastraInstance = request.mastra;
  const agents = Object.keys(mastraInstance.listAgents());
  return { status: 'ok', agents };
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

Access these in route handlers via `request`:

| Key              | Description                 |
| ---------------- | --------------------------- |
| `mastra`         | Mastra instance             |
| `requestContext` | Request context map         |
| `abortSignal`    | Request cancellation signal |
| `tools`          | Available tools             |

## Multipart File Uploads

For multipart file uploads, register `@fastify/multipart`:

```typescript
import multipart from '@fastify/multipart';

await app.register(multipart);
```

## Related Links

- [Server Adapters Documentation](https://mastra.ai/docs/v1/server-db/server-adapters)
- [Fastify Documentation](https://fastify.dev/docs/latest/)
