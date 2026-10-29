---
'@mastra/elysia': patch
'@mastra/koa': patch
---

The Elysia and Koa adapters no longer log 4xx errors thrown by route handlers as server errors, matching the Hono, Express, and Fastify adapters. In Koa, these errors still reach `error` listeners your app registers, but no longer reach Koa's default listener, which prints them to `console.error`.
