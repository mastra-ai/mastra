---
'@mastra/mongodb': minor
---

Added storage retention support to MongoDB. When you set a `retention` config, `MongoDBStore` can prune old documents from every growth domain it implements: `memory` (threads, messages, resources by `createdAt`), `observability` (spans by `startedAt`), `scores` (by `createdAt`), `workflows` (run snapshots by `updatedAt`), `backgroundTasks` (by `completedAt`, so in-flight tasks are never pruned), `experiments` (whole runs by `completedAt`, results cascade with their parent — transactional on replica sets), `notifications` (by `createdAt`), and `schedules` fire history (by `actual_fire_at`).

Deletes run in batches via bounded `find(_id)` + `deleteMany` pairs (bounded, resumable, and cancellable) so they stay safe on large collections. Anchor-field indexes are created lazily on the first `prune()` call — never at init — so deployments that don't configure retention pay no extra index overhead. `prune()` only deletes documents; WiredTiger reuses the freed space for subsequent writes.

```typescript
const storage = new MongoDBStore({
  id: 'mastra-storage',
  uri: process.env.MONGODB_URI,
  dbName: 'mastra',
  retention: {
    memory: { messages: { maxAge: '30d' } },
    observability: { spans: { maxAge: '7d' } },
  },
})

await storage.prune()
```
