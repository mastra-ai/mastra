---
'@mastra/fastify': patch
---

Fixed CORS headers not being included in stream responses when using the Fastify adapter. Headers set by plugins (like @fastify/cors) are now preserved when streaming.
