---
'@mastra/client-js': minor
---

Added `withRunStatus: true` to thread subscriptions to receive retained and live `thread-run-status` outcomes. Callback types include run statuses only when requested.

```ts
const subscription = await agent.subscribeToThread({
  resourceId: 'user-123',
  threadId: 'thread-456',
  withRunStatus: true,
});
await subscription.processDataStream({
  onChunk: chunk => {
    if (chunk.type === 'thread-run-status') console.log(chunk.runId, chunk.payload.status);
  },
});
```
