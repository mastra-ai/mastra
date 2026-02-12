---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/server': patch
---

Fixed custom API routes registered via `registerApiRoute()` being silently ignored by Koa, Express, Fastify, and Hono server adapters. Routes previously appeared in the OpenAPI spec but returned 404 at runtime. Custom routes now work correctly across all server adapters.

**Example:**

```ts
import Koa from 'koa';
import { Mastra } from '@mastra/core';
import { registerApiRoute } from '@mastra/core/server';
import { MastraServer } from '@mastra/koa';

const mastra = new Mastra({
  server: {
    apiRoutes: [
      registerApiRoute('/hello', {
        method: 'GET',
        handler: async c => c.json({ message: 'Hello!' }),
      }),
    ],
  },
});

const app = new Koa();
const server = new MastraServer({ app, mastra });
await server.init();
// GET /hello now returns 200 instead of 404
```
