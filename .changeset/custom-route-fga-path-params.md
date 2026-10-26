---
'@mastra/hono': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/koa': patch
'@mastra/elysia': patch
---

Fixed an authorization bypass on custom API routes that use FGA. A query string or request body field with the same name as a path parameter could change which resource was checked, so a request like `GET /docs/locked?docId=open` was authorized against `open` instead of `locked`. Path parameters now always take precedence when resolving the FGA resource ID.
