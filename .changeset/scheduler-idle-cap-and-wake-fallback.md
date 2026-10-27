---
'@mastra/core': patch
---

Fixed schedules being missed when the scheduler was idle. The scheduler now checks storage at least once an hour, even when it has no active schedules or the next fire is far away. Schedules written by another process that doesn't share a pubsub, or written directly to storage, are now picked up within that hour instead of waiting for a restart. Use `scheduler.maxSleepMs` to change the interval.

Fixed new schedules not firing on time when the scheduler wake event failed to publish. The scheduler in the same process is now woken directly.

```ts
const mastra = new Mastra({ scheduler: { maxSleepMs: 60_000 } });
```
