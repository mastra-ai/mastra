---
'@mastra/core': patch
---

Fixed thread subscriptions to emit ordered `thread-run-status` chunks with `success`, `failed`, `aborted`, or `suspended` outcomes without closing the subscription. Reconnecting subscribers recover outcomes retained by the PubSub backend. Initial history includes `activeRunId`, the run owning the thread during hydration, or `null` when idle.

```ts
for await (const chunk of subscription.stream) {
  if (chunk.type === 'thread-run-status') {
    console.log(chunk.runId, chunk.payload.status);
  }
}
```
