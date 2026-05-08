---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/server': patch
---

Custom API route streams in Node-based adapters now stop reading when clients disconnect, custom route handlers receive the request abort signal, and upstream response body stream errors are rethrown instead of being treated as client disconnects.

```ts
registerApiRoute('/stream', {
  method: 'GET',
  handler: async c => {
    const stream = await agent.stream(prompt, {
      abortSignal: c.req.raw.signal,
    });

    return stream.toTextStreamResponse();
  },
});
```
