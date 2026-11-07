---
'@mastra/express': patch
'@mastra/koa': patch
'@mastra/fastify': patch
'@mastra/nestjs': patch
'@mastra/elysia': patch
---

Fixed the route abort signal never firing when the client disconnected while earlier middleware or hooks (such as async auth) were still running. The signal is now already aborted when the route starts, so routes and agent runs that check `abortSignal.aborted` stop instead of running on. Durable and other resumable agent runs keep running after a disconnect, as before. Fixes [#28480](https://github.com/mastra-ai/mastra/issues/28480).
