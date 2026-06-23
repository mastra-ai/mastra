---
'@mastra/core': minor
---

Added `untilIdle` option to `DurableAgent.stream()` — pass `untilIdle: true` or `{ maxIdleMs }` to keep the stream open across background-task continuations. This is the same behavior as the now-deprecated `streamUntilIdle()` method, matching the consolidation done for the non-durable Agent in #17536.

```ts
// Before (deprecated)
const result = await durableAgent.streamUntilIdle('Research topic', {
  memory: { thread: 't1', resource: 'u1' },
});

// After
const result = await durableAgent.stream('Research topic', {
  untilIdle: true,
  memory: { thread: 't1', resource: 'u1' },
});
```
