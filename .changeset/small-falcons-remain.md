---
'@mastra/fastify': patch
---

Fixed custom API routes in the Fastify adapter not applying the server prefix, causing routes to mount at bare paths instead of under the configured prefix.
