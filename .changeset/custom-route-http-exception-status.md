---
'@mastra/server': patch
'@mastra/nestjs': patch
---

Custom routes registered with `registerApiRoute` now keep the status and message of an `HTTPException` they throw, on every server adapter (Hono, Express, Fastify, Koa, Elysia and NestJS). Before this fix, the client got a generic `500 Internal Server Error` instead.

```ts
import { HTTPException } from 'hono/http-exception';

registerApiRoute('/widgets/:id', {
  method: 'GET',
  handler: async c => {
    throw new HTTPException(404, { message: 'Widget not found' }); // client gets 404 { "error": "Widget not found" }
  },
});
```

An `HTTPException` with a custom `res` returns that response, headers included. Other errors still return a generic 500 and are logged on the server.
