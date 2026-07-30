---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/server': patch
---

Added an actionable server warning when an agent channel webhook returns 404 because its channel adapter route was not registered.
