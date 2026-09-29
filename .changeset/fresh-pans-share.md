---
'@mastra/client-js': minor
'@mastra/cloudflare-d1': patch
'@mastra/elasticsearch': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/memory': patch
'@mastra/server': patch
'@mastra/dynamodb': patch
'@mastra/oracledb': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/upstash': patch
'@mastra/core': patch
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

Added `thread.archive()` and `thread.unarchive()`, and an `archived` option on `listMemoryThreads()`.

```ts
await mastraClient.getMemoryThread({ threadId: 'thread-123', agentId: 'agent-1' }).archive();
const active = await mastraClient.listMemoryThreads({ resourceId: 'user-123', archived: false });
```
