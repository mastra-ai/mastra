---
'@mastra/server': patch
'@mastra/fastify': patch
'@mastra/express': patch
'@mastra/koa': patch
'@mastra/hono': patch
---

Fixed custom API routes prefix handling across all adapters. Custom routes now respect the configured prefix but the `/api` prefix is reserved for built-in Mastra routes — custom routes with `/api` prefix are served at bare paths to prevent collisions with future built-in routes.
