---
'@mastra/server': patch
'@mastra/fastify': patch
'@mastra/express': patch
'@mastra/koa': patch
'@mastra/hono': patch
---

Fixed custom API routes prefix handling across all adapters. Custom routes now respect the configured prefix. Using `/api` as the prefix for custom routes now throws an error — it is reserved for built-in Mastra routes. Set a different `apiPrefix` (e.g. `apiPrefix: '/v1'`) in your server config when using custom routes.
