---
'@mastra/hono': patch
'@mastra/express': patch
'@mastra/koa': patch
'@mastra/fastify': patch
'@mastra/elysia': patch
---

Handler errors with status 501 Not Implemented are now logged as warnings instead of errors, so unsupported optional features no longer produce error-level logs.
