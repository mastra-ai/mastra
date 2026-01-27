---
'@mastra/core': patch
---

Let callers cancel a running agent network call and handle abort callbacks.

**Example**
Before:
```ts
const stream = await agent.network(task);
```

After:
```ts
const controller = new AbortController();
const stream = await agent.network(task, {
  abortSignal: controller.signal,
  onAbort: ({ primitiveType, primitiveId }) => {
    logger.info(`Aborted ${primitiveType}:${primitiveId}`);
  },
});

controller.abort();
```

Related issue: `#12282`
