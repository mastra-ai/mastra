---
'@mastra/server': minor
---

Added `POST /api/agents/:agentId/threads/signals/cancel` to cancel selected pending input across Agents sharing a memory thread. The route checks thread ownership and accepts 1–1,000 signal IDs:

```json
{ "resourceId": "user-123", "threadId": "thread-abc", "signalIds": ["signal-123"] }
```

The response contains `cancelledSignalIds`, listing only IDs cancelled on the receiving process. Those IDs are published through shared PubSub so other subscribed processes can remove matching pending copies. Propagation is asynchronous and best-effort, without remote acknowledgements. Thread abort requests also accept `clearPendingSignals: true` to clear pending input before aborting. Omitting the flag preserves existing behavior.

Both cancellation routes enforce thread write access when fine-grained authorization is configured, even before a thread is saved. Thread-wide cancellation and clear-on-abort return HTTP 501 when the Agent's core version doesn't support them. Upgrade `@mastra/core` alongside `@mastra/server` on every worker.
