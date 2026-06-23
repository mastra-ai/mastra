---
'@mastra/inngest': minor
---

Added `untilIdle` option to `InngestAgent.stream()` — pass `untilIdle: true` or `{ maxIdleMs }` to keep the stream open across background-task continuations, matching the `DurableAgent` and non-durable `Agent` APIs.

```ts
const result = await inngestAgent.stream('Research topic', {
  untilIdle: true,
  memory: { thread: 't1', resource: 'u1' },
});
```
