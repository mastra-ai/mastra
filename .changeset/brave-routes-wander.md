---
'@mastra/hono': patch
'@mastra/fastify': patch
'@mastra/elysia': patch
'@mastra/nestjs': patch
---

Requests to an unmatched route now return a 404 with `code` set to `ROUTE_NOT_FOUND` and `{ method, path }` in `metadata`, so clients can tell a missing route apart from a missing resource.

```ts
const res = await fetch('/api/custom/missing');
const body = await res.json();

if (body.code === 'ROUTE_NOT_FOUND') {
  console.log(`No route for ${body.metadata.method} ${body.metadata.path}`);
}
```
