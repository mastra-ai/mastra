---
'@mastra/core': patch
---

Fixed schedules being missed when a running scheduler was idle. Once running, the scheduler now checks storage at least once an hour, even after its schedules are removed or when the next fire is far away. Schedules written by another process that doesn't share a pubsub, or written directly to storage, are picked up within that hour instead of waiting for a restart. Use `scheduler.maxSleepMs` to change the interval. A process with no schedules at startup still doesn't start the scheduler; set `scheduler: { enabled: true }` to have it check storage every `tickIntervalMs`.

Fixed new schedules not firing on time when the scheduler wake event failed to publish. The scheduler in the same process is now woken directly.

```ts
const mastra = new Mastra({ scheduler: { maxSleepMs: 60_000 } });
```
