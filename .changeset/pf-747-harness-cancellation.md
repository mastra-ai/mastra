---
'@mastra/core': minor
---

Add Harness v1 cancellation APIs so applications can stop session work durably.

```ts
await session.cancel({ reason: 'user_requested' });
await session.cancelQueuedItem({ queuedItemId, reason: 'timed_out' });
```

`session.cancel()` cancels active and queued work for the session, emits `task_cancellation_requested`, and prevents later turns from being admitted. `session.cancelQueuedItem()` cancels a queued item that has not reached the queue head yet and emits `queue_item_cancelled`.
