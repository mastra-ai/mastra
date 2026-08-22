---
'@mastra/hono': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/koa': patch
'@mastra/nestjs': patch
---

Fixed a bug where a stream that failed partway through would just cut off with no error and no `[DONE]` marker, making a broken response look identical to a clean finish. Streaming responses now send a `type: 'error'` frame and a final `[DONE]` marker when the connection breaks mid-response, so clients can detect the failure instead of hanging or silently dropping data.

Express, Fastify, Koa, and the NestJS interceptor were also missing the `[DONE]` marker on successful streams entirely (only Hono sent it) — all four now send it consistently with Hono.
