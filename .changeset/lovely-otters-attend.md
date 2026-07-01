---
'@mastra/libsql': minor
---

Added storage retention support to libSQL. When you set a `retention` config, `LibSQLStore` can prune old rows from the `memory` domain (threads, messages, and resources by `createdAt`) and the `observability` domain (spans by `startedAt`).

Deletes run in batches so they stay safe on large tables, and anchor columns are indexed so the sweeps stay fast. `prune()` only deletes rows; reclaiming disk (for example a `VACUUM` on self-hosted libSQL) is left to you to run in a maintenance window.

```typescript
const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: 'file:./mastra.db',
  retention: {
    memory: { messages: { maxAge: '30d' } },
    observability: { spans: { maxAge: '7d' } },
  },
})

await storage.prune()
```
