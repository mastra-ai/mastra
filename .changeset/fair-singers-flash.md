---
'@mastra/hono': patch
'@mastra/elysia': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/koa': patch
'@mastra/nestjs': patch
---

Fixed multipart form parsing to safely handle field names that collide with built-in object properties
