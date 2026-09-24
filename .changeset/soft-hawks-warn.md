---
'@mastra/hono': patch
'@mastra/express': patch
'@mastra/koa': patch
'@mastra/fastify': patch
'@mastra/elysia': patch
---

Handler errors with status 501 Not Implemented are now logged as warnings instead of errors. A 501 means the configured storage does not support an optional feature, not a server failure.
