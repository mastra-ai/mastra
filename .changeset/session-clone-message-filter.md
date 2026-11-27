---
'@mastra/core': minor
---

Added `metadata` and `options` to `session.thread.clone()` and `session.thread.cloneToCurrentResource()`. `options` takes the same `messageFilter`, `messageLimit` and `fullThread` as `memory.cloneThread()`, so a clone can carry the source thread's observational and working memory without copying its old messages. `fullThread: true` with `messageFilter` or `messageLimit` throws before anything is copied, with or without a configured memory. `metadata` sets the clone's metadata; with `cloneToCurrentResource()` it replaces the source thread's, so the clone no longer inherits settings like the source's project path. Left out, both methods behave as before.

```ts
const clone = await session.thread.clone({
  sourceThreadId: 'thread-7',
  metadata: { clonedFrom: 'thread-7' },
  options: { messageFilter: { startDate: new Date() } },
});
```
