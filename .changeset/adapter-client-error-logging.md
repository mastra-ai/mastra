---
'@mastra/elysia': patch
'@mastra/koa': patch
---

The Elysia and Koa adapters no longer log 4xx errors thrown by route handlers as server errors, matching the Hono, Express, and Fastify adapters.

In Koa, 4xx errors and 501 Not Implemented errors are still emitted to every `error` listener your app registers, including a custom `app.onerror` and listeners added after `listen()`. Only Koa's built-in default listener, which prints to `console.error`, is skipped for them. 5xx errors reach all listeners as before.
