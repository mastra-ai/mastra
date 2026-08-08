---
'@mastra/server': patch
'@mastra/hono': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/koa': patch
---

Fixed streaming responses being dropped during long silent periods.

A workflow step that runs for minutes without emitting events (for example a step waiting on a sandbox) left the response stream idle, and proxies and hosting platforms close idle responses — so clients stopped receiving updates even though the run was still progressing. Streaming responses now write a keepalive frame every 20 seconds while there is nothing else to send: an SSE comment for `text/event-stream` responses and an empty record for record-separator streams, both of which clients already skip.

**Configuring keepalives**

```ts
new MastraServer({
  app,
  mastra,
  streamOptions: {
    keepaliveMs: 10_000, // default: 20_000, set to 0 to disable
  },
});
```
