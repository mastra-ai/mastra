---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/nestjs': patch
'@mastra/hono': patch
'@mastra/koa': patch
---

Fixed workflow and agent HTTP streams silently dying when a stream chunk contained values that cannot be serialized to JSON (such as BigInt produced by zod coercions in structuredOutput schemas). In Studio this made workflow step nodes appear stuck in the "running" state even though the run completed successfully on the server.

Unserializable values are now safely converted (BigInt to string, circular references to "[Circular]"). If a chunk still cannot be serialized at all, it is skipped with an error log that includes the route path and reason, instead of killing the stream and dropping all remaining chunks. Fixes [#17821](https://github.com/mastra-ai/mastra/issues/17821)
