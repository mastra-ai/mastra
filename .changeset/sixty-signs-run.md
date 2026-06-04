---
'@mastra/core': patch
---

Added `untilIdle` option to `stream()` and `resumeStream()` methods. Pass `untilIdle: true` (or `untilIdle: { maxIdleMs: 60_000 }`) to keep the stream open across background-task continuations — same behavior as the now-deprecated `streamUntilIdle()` method.

**Example:**

```ts
const result = await agent.stream('Research solana for me', {
  untilIdle: true,
  memory: { thread: 't1', resource: 'u1' },
});
```

Deprecated `streamUntilIdle()` and `resumeStreamUntilIdle()` — they still work but now delegate internally to `stream({ untilIdle: true })`.
