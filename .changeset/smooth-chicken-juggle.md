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
'@mastra/client-js': patch
'@mastra/memory': patch
'@mastra/server': patch
'@mastra/core': patch
---

Added support for thread archiving. Threads now store an `archivedAt` timestamp, and `listThreads` supports the `archived` filter. Existing tables get the new nullable column automatically on `init()`; existing threads are treated as not archived.

```typescript
// Existing calls continue to return both active and archived threads.
await memory.listThreads({ filter: { resourceId: 'user-123' } });

await memory.archiveThread({ threadId: 'thread-123' });

// Exclude archived threads from active conversation lists.
await memory.listThreads({
  filter: { resourceId: 'user-123', archived: false },
});

// Retrieve archived threads, then restore a conversation.
await memory.listThreads({
  filter: { resourceId: 'user-123', archived: true },
});
await memory.unarchiveThread({ threadId: 'thread-123' });
```
