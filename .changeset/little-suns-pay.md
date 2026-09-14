---
'@mastra/server': minor
---

Added `POST /agents/:agentId/threads/signals/cancel` to cancel selected process-local pending input across Agents sharing a memory thread. The route checks thread ownership and accepts 1–1,000 signal IDs:

```json
{ "resourceId": "user-123", "threadId": "thread-abc", "signalIds": ["signal-123"] }
```

The response contains `cancelledSignalIds`, listing only IDs cancelled by the call. Thread abort requests also accept `clearPendingSignals: true` to clear pending input before aborting. Omitting the flag preserves existing behavior.
