---
'@mastra/spanner': minor
---

Added five new storage domains to the Google Cloud Spanner adapter: **workspaces**, **datasets**, **experiments**, **favorites**, and **channels**. The Spanner store now covers the full set of editor and evaluation domains.

**What's new**

- **Datasets** versioned dataset items with historical snapshots and as-of reads (time-travel reads, per-item history, batched insert/delete).
- **Experiments** with per-item results, review-status aggregation, and pagination.
- **Workspaces** with versioned configuration snapshots (filesystem, sandbox, mounts, search, skills, tools), mirroring the existing thin-record + versions pattern.
- **Favorites** for agents and skills, maintaining a denormalized `favoriteCount` on the parent record atomically.
- **Channels** for multi-platform installations and per-platform configuration.

Enabling favorites also adds favorited-first ordering and `favoritedOnly` / `entityIds` filtering to `agents.list()` and `skills.list()`, and surfaces `favoriteCount` on skill records.

```typescript
const storage = new SpannerStore({
  id: 'spanner-storage',
  projectId: process.env.SPANNER_PROJECT_ID!,
  instanceId: process.env.SPANNER_INSTANCE_ID!,
  databaseId: process.env.SPANNER_DATABASE_ID!,
})

const datasets = await storage.getStore('datasets')
const ds = await datasets?.createDataset({ name: 'eval-set' })

const favorites = await storage.getStore('favorites')
await favorites?.favorite({ userId: 'u1', entityType: 'agent', entityId: 'agent-1' })
```
