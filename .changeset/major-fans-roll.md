---
'@mastra/memory': minor
'@mastra/core': patch
'@mastra/libsql': patch
---

Added experimental Subconscious capture configuration for Observational Memory. Conversations can now extract scoped knowledge nodes and items into durable storage and reconcile them into a semantic vector index.

```ts
const memory = new Memory({
  storage,
  vector,
  embedder,
  options: {
    observationalMemory: {
      experimental_subconscious: new Subconscious(),
    },
  },
});
```
