---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/server': patch
---

Developers can now cancel long-running custom API route work when clients disconnect. Node-based adapters pass abort signals into custom route handlers, clean up response streams correctly, and still surface upstream response body errors.

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
