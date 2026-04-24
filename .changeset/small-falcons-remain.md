---
'@mastra/fastify': patch
'@mastra/express': patch
'@mastra/koa': patch
---

Fixed custom API routes not applying the server prefix in the Fastify, Express, and Koa adapters, causing routes to mount at bare paths instead of under the configured prefix.
