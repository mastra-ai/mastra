---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
---

Fixed HTTP request logs to redact sensitive query parameters like tokens and API keys, preventing credential exposure in server logs.
