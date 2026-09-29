---
'@mastra/core': minor
'@mastra/memory': minor
'@mastra/client-js': patch
'@mastra/cloudflare-d1': patch
'@mastra/elasticsearch': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/server': patch
'@mastra/dynamodb': patch
'@mastra/oracledb': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/upstash': patch
'@mastra/convex': patch
'@mastra/libsql': patch
'@mastra/valkey': patch
'@mastra/lance': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/redis': patch
'@mastra/dsql': patch
'@mastra/pg': patch
---

Added thread archiving. Archived threads are kept with their messages but can be hidden from thread lists, and restored later. Archiving does not change `updatedAt`, so thread order is preserved.

```ts
await memory.archiveThread({ threadId: 'thread-123' });

const active = await memory.listThreads({
  filter: { resourceId: 'user-123', archived: false },
});

await memory.unarchiveThread({ threadId: 'thread-123' });
```

Omitting `archived` returns all threads, as before.
