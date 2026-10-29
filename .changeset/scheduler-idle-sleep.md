---
'@mastra/core': minor
---

Added `scheduler.maxIdleIntervalMs` to cap how long an idle scheduler sleeps between storage checks.

```ts
const mastra = new Mastra({
  scheduler: { enabled: true, maxIdleIntervalMs: 15 * 60_000 },
});
```

By default, an idle scheduler sleeps until the next schedule is due. Changes made through `mastra.schedules` wake it early.

Set `maxIdleIntervalMs` to also find schedules that don't send a wake event, such as rows written straight to storage or by a process that shares no pubsub. The scheduler then checks storage at least once per `maxIdleIntervalMs`. A value at or below `tickIntervalMs` checks on every tick.

With `enabled: true`, the scheduler normally checks storage every `tickIntervalMs`. Setting `maxIdleIntervalMs` lets it sleep instead, so scale-to-zero databases such as Neon can suspend.
