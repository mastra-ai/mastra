---
'@mastra/elysia': patch
'@mastra/koa': patch
---

The Elysia and Koa adapters no longer log 4xx errors thrown by route handlers as server errors, matching the Hono, Express, and Fastify adapters.
