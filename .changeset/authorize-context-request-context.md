---
'@mastra/server': patch
'@mastra/elysia': patch
'@mastra/server-adapters-test-suite': patch
---

`server.auth.authorize(path, method, user, context)` can now call `context.get('requestContext')` and `context.get('mastra')` on the Express, Fastify, Koa and Elysia adapters, as it already could on Hono. Values an app sets on the request context in `authorize` (such as `MASTRA_KNOWLEDGE_SCOPE_KEY`) now reach route handlers on every adapter.

The Elysia adapter now keeps every value of a repeated query parameter (`?tag=a&tag=b` reads as `['a', 'b']`), matching the other adapters.
