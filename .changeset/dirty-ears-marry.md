---
'@mastra/fastify': patch
---

Fixed custom API route responses dropping headers set by Fastify plugins. Headers applied via Fastify hooks (e.g. `Access-Control-Allow-Origin` from `@fastify/cors`) were overwritten when the adapter hijacked the reply to stream the custom route response. The adapter now merges hook-set headers into the response before hijack — matching the behavior already implemented for streaming routes.
