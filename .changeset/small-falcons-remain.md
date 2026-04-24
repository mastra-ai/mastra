---
'@mastra/fastify': patch
'@mastra/hono': patch
---

Fixed custom API routes not applying the server prefix, causing routes to mount at bare paths instead of prefixed paths.
