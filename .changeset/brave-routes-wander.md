---
'@mastra/hono': patch
'@mastra/fastify': patch
'@mastra/elysia': patch
'@mastra/nestjs': patch
---

Requests to an unmatched route now return a 404 with `problem.code` set to `ROUTE_NOT_FOUND` and `{ method, path }` in `problem.metadata`, so clients can tell a missing route apart from a missing resource.

```ts
const res = await fetch('/api/custom/missing');
const { problem } = await res.json();

if (problem?.code === 'ROUTE_NOT_FOUND') {
  console.log(`No route for ${problem.metadata.method} ${problem.metadata.path}`);
}
```
