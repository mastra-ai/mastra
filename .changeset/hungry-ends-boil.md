---
'@mastra/server': minor
'@mastra/client-js': patch
'@mastra/cloudflare-d1': patch
'@mastra/elasticsearch': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/memory': patch
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

Added `POST /memory/threads/:threadId/archive` and `POST /memory/threads/:threadId/unarchive` routes, and an `archived` query parameter on `GET /memory/threads`. Thread responses now include `archivedAt`.

Archive a thread without deleting its messages, then restore it:

```http
POST /api/memory/threads/thread-123/archive?agentId=my-agent
```

```http
POST /api/memory/threads/thread-123/unarchive?agentId=my-agent
```

List only active threads with `GET /api/memory/threads?agentId=my-agent&archived=false`. Omitting `archived` continues to return both active and archived threads.
