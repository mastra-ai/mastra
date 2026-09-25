---
'@mastra/core': minor
---

Added `withInitialHistory` to `subscribeToThread`. The subscription first emits a single `thread-history` chunk with the stored thread messages, then only the retained parts that storage doesn't already cover, then live parts. Completed runs no longer replay on a retained backend such as Redis Streams, so chat UIs skip the replay animation and answered tool approvals aren't re-run. Pending approvals still come through so clients can prompt for them, and approvals already answered by a resumed run don't. Parts are compared to storage by when the model produced them, so slow publishing can't make stored parts appear again.

`AgentController` sessions now subscribe with `withInitialHistory`, so a session opened after a restart no longer re-acts on approvals from runs that already finished.

The `thread-history` chunk type only appears on subscriptions that pass `withInitialHistory`; `agent.stream()` and plain subscriptions are typed exactly as before.

```ts
const subscription = await agent.subscribeToThread({
  threadId,
  resourceId,
  withInitialHistory: { perPage: 40 },
});

for await (const chunk of subscription.stream) {
  if (chunk.type === 'thread-history') renderHistory(chunk.payload.messages);
  else applyLiveChunk(chunk);
}
```
