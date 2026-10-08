---
'@mastra/memory': patch
---

Added `Subconscious.settled()`, which waits for observation-time curator runs to finish. Curation runs detached from the observation turn and separately from observational memory, so `memory.settled()` does not wait for it. Await both before closing storage the curator writes to:

```ts
await memory.settled();
await subconscious.settled();
await store.close();
```

Added actionable guidance for unknown Subconscious observation agents.
