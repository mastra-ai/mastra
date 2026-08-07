---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/koa': patch
---

Guard `reader.cancel()` in the server adapters so a client disconnect cannot crash the process.

When a client disconnects mid-stream, each adapter's abort/error handler tore down the reader with an unguarded `void reader.cancel(reason)`. If the underlying stream's teardown rejects — for example an in-flight storage write failing while the stream is cancelled — the rejection was never handled. On Node >= 15 an unhandled promise rejection terminates the process, so a single ill-timed disconnect could take down the server and drop every other in-flight request.

Cancellation is best-effort teardown, so the rejection is now swallowed with the `.catch(() => {})` idiom already used elsewhere in the codebase (for example `client-sdks/client-js` and `integrations/livekit`). The `hono` adapter already had this guard; this brings `express`, `fastify` and `koa` in line.
