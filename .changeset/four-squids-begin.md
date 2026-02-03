---
'@mastra/fastify': patch
---

Fixed missing cross-origin headers on streaming responses when using the Fastify adapter. Headers set by plugins (like @fastify/cors) are now preserved when streaming. See https://github.com/mastra-ai/mastra/issues/12622
