---
'@mastra/elysia': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/nestjs': patch
'@mastra/next': patch
'@mastra/tanstack-start': patch
---

Raised the `@mastra/core` peer dependency floor to 1.82.0 to match `@mastra/server`, which now requires `@mastra/core` 1.82.0 or later. Upgrade `@mastra/core` together with your server adapter.
