---
'@mastra/core': minor
---

Added `backgroundTasks.untilIdleMaxIdleMs` to set the default idle timeout for `stream({ untilIdle: true })`. Before, calls that did not pass `maxIdleMs` always closed after 5 minutes without new events. This included calls Mastra makes internally, such as waking an agent after `sendMessage`. A background task that ran longer than that finished without a continuation turn. A per-call `untilIdle: { maxIdleMs }` still takes precedence.

```ts
const mastra = new Mastra({
  backgroundTasks: {
    enabled: true,
    untilIdleMaxIdleMs: 30 * 60_000,
  },
});
```
