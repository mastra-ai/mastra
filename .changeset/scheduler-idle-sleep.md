---
'@mastra/core': minor
---

Added `scheduler.maxIdleIntervalMs` to cap how long an idle scheduler sleeps between storage checks.

```ts
const mastra = new Mastra({
  scheduler: { enabled: true, maxIdleIntervalMs: 15 * 60_000 },
});
```

By default an idle scheduler sleeps until the earliest active schedule's next fire and is woken by changes made through `mastra.schedules`. Set `maxIdleIntervalMs` to also pick up rows written to storage directly, or by a process that shares no pubsub, within that interval. With `enabled: true`, it switches the fixed `tickIntervalMs` poll to the same capped sleep, so scale-to-zero databases such as Neon can suspend.
