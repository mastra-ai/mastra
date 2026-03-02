---
'@mastra/core': minor
'mastracode': patch
---

**@mastra/core:** Added optional `threadLock` callbacks to `HarnessConfig` for preventing concurrent thread access across processes. The Harness calls `acquire`/`release` during `selectOrCreateThread`, `createThread`, and `switchThread` when configured. Locking is opt-in — when `threadLock` is not provided, behavior is unchanged.

```ts
const harness = new Harness({
  id: 'my-harness',
  storage: myStore,
  modes: [{ id: 'default', agent: myAgent }],
  threadLock: {
    acquire: (threadId) => acquireThreadLock(threadId),
    release: (threadId) => releaseThreadLock(threadId),
  },
});
```

**mastracode:** Wires the existing filesystem-based thread lock (`thread-lock.ts`) into the new `threadLock` config, restoring the concurrent access protection that was lost during the monorepo migration.
