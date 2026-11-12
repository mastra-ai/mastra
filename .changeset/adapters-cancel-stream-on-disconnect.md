---
'@mastra/koa': patch
'@mastra/fastify': patch
'@mastra/nestjs': patch
'@mastra/elysia': patch
---

Fixed streaming routes that kept reading the response stream after the client disconnected. The server now stops the stream when the client goes away, including a client that leaves before the route handler returns, and it waits for a slow client to catch up instead of buffering the whole stream in memory. On NestJS this also keeps durable agent runs available to `/observe` after the client drops an `untilIdle` stream. Fixes [#29640](https://github.com/mastra-ai/mastra/issues/29640).
