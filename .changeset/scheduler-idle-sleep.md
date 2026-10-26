---
'@mastra/core': minor
---

Added `scheduler.maxIdleIntervalMs` so the scheduler can stop querying storage every tick while no schedule is due. This lets scale-to-zero databases such as Neon suspend.

```ts
const mastra = new Mastra({
  scheduler: { maxIdleIntervalMs: 15 * 60_000 },
});
```

When nothing is due, the scheduler sleeps until the earliest active schedule's next fire time, capped at `maxIdleIntervalMs`. Creating, updating, or resuming a schedule through `mastra.schedules` wakes it right away, including in other processes that share a pubsub. Rows written to storage directly, or by a process without a shared pubsub, are picked up within the cap. The default is unchanged: storage is queried every `tickIntervalMs`.
