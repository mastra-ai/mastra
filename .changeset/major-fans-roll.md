---
'@mastra/memory': minor
'@mastra/core': patch
'@mastra/libsql': patch
---

Added Subconscious capture configuration for Observational Memory. Conversations can now extract scoped entities and facts into durable knowledge storage and reconcile them into a semantic vector index.

```ts
const memory = new Memory({
  storage,
  vector,
  embedder,
  options: {
    observationalMemory: {
      subconscious: new Subconscious(),
    },
  },
});
```
