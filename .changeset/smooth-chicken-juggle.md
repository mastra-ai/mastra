---
'@mastra/clickhouse': minor
'@mastra/cloudflare': minor
'@mastra/cloudflare-d1': minor
'@mastra/convex': minor
'@mastra/dsql': minor
'@mastra/dynamodb': minor
'@mastra/elasticsearch': minor
'@mastra/lance': minor
'@mastra/libsql': minor
'@mastra/mongodb': minor
'@mastra/mssql': minor
'@mastra/mysql': minor
'@mastra/oracledb': minor
'@mastra/pg': minor
'@mastra/redis': minor
'@mastra/spanner': minor
'@mastra/upstash': minor
'@mastra/valkey': minor
---

Added storage support for thread archiving. Threads now store a nullable `archivedAt` timestamp, and `listThreads` supports the `archived` filter. Existing tables get the new column automatically on `init()`; existing threads are treated as not archived.

```typescript
await storage.init();

const memoryStore = await storage.getStore('memory');
const active = await memoryStore?.listThreads({
  filter: { resourceId: 'user-123', archived: false },
});
```

On ClickHouse, archiving inserts a new version of the thread row instead of running an `ALTER TABLE ... UPDATE` mutation, so it also updates the thread's `updatedAt`.
