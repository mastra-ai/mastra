---
'@mastra/libsql': minor
---

Added storage retention support to libSQL. When you set a `retention` config, `LibSQLStore` can prune old rows from every growth-table domain: `memory` (threads, messages, resources by `createdAt`), `threadState` (by `updatedAt`), `observability` (spans by `startedAt`), `scores` (by `createdAt`), `workflows` (run snapshots by `updatedAt`), `backgroundTasks` (by `completedAt`, so in-flight tasks are never pruned), `experiments` (whole runs by `completedAt`, results cascade with their parent), `notifications` and `harness` sessions (by `createdAt`), and `schedules` fire history (by `actual_fire_at`).

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
