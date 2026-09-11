---
'@mastra/client-js': minor
---

Added `agent.listPendingSignals()` and `agent.removePendingSignals()` for inspecting and cancelling queued delivery scoped to an agent ID and thread. Signal contents include typed text and file parts.

```ts
const agent = client.getAgent('my-agent');
const { signals } = await agent.listPendingSignals({ threadId, resourceId });
const signalIds = signals.slice(0, 2).map(entry => entry.signal.id);
if (signalIds.length > 0) {
  const { removedSignalIds } = await agent.removePendingSignals({ threadId, resourceId, signalIds });
}
```

Removal accepts 1–1,000 non-empty IDs and returns only those actually removed, in request order without duplicates. Both methods reflect only the server process handling the request. Removal does not roll back state updates, notification status, or acceptance results.
