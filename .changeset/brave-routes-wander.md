---
'@mastra/hono': patch
'@mastra/fastify': patch
'@mastra/elysia': patch
'@mastra/nestjs': patch
---

Requests to an unmatched route now return a 404 with `problem.code` set to `ROUTE_NOT_FOUND` and `{ method, path }` in `problem.metadata`, so clients can tell a missing route apart from a missing resource.
