---
'@mastra/koa': patch
'@mastra/fastify': patch
---

Streaming routes now stop reading the response stream when the client disconnects, matching the Express and Hono adapters. Before, Koa read every dropped `datastream-response` body (such as `/agents/:agentId/stream-legacy`) to the end, and both Koa and Fastify read the whole stream when the client dropped before the route handler returned. This wasted upstream work, such as model tokens, after nobody was listening.
