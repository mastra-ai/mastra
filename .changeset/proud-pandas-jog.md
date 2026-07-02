---
'@mastra/pg': minor
---

Added storage retention support to PostgreSQL. When you set a `retention` config, `PostgresStore` can prune old rows from every growth-table domain it implements: `memory` (threads, messages, resources by `createdAtZ`), `observability` (spans by `startedAtZ`), `scores` (by `createdAtZ`), `workflows` (run snapshots by `updatedAtZ`), `backgroundTasks` (by `completedAtZ`, so in-flight tasks are never pruned), `experiments` (whole runs by `completedAtZ`, results cascade with their parent), `notifications` (by `createdAtZ`), and `schedules` fire history (by `actual_fire_at`).

Deletes run in batches via `ctid` subqueries (bounded, resumable, and cancellable) so they stay safe on large tables, and anchor columns are indexed so the sweeps stay fast. `prune()` only deletes rows; PostgreSQL's autovacuum reclaims the dead tuples for reuse.

```typescript
const storage = new PostgresStore({
  id: 'mastra-storage',
  connectionString: process.env.DATABASE_URL,
  retention: {
    memory: { messages: { maxAge: '30d' } },
    observability: { spans: { maxAge: '7d' } },
  },
})

await storage.prune()
```
