---
'@mastra/express': patch
'@mastra/koa': patch
'@mastra/fastify': patch
'@mastra/nestjs': patch
'@mastra/elysia': patch
---

Fixed the route abort signal never firing when the client disconnected while earlier middleware or hooks (such as async auth) were still running. Agent runs and streaming routes now stop in that case instead of running on. Fixes [#28480](https://github.com/mastra-ai/mastra/issues/28480).
