---
'@mastra/clickhouse': minor
'@mastra/cloudflare': minor
'@mastra/cloudflare-d1': minor
'@mastra/convex': minor
'@mastra/core': minor
'@mastra/client-js': minor
'@mastra/dsql': minor
'@mastra/dynamodb': minor
'@mastra/lance': minor
'@mastra/libsql': minor
'@mastra/memory': minor
'@mastra/mongodb': minor
'@mastra/mssql': minor
'@mastra/mysql': minor
'@mastra/pg': minor
'@mastra/redis': minor
'@mastra/server': minor
'@mastra/spanner': minor
'@mastra/upstash': minor
---

Added exact metadata filtering to message history queries across Memory APIs and supported storage providers.

```ts
const messages = await memory.recall({
  threadId: 'thread-1',
  filter: {
    metadata: {
      status: 'done',
      priority: 'high',
    },
  },
})
```

Multiple fields use AND semantics. Supported values are strings, finite numbers, booleans, and `null`.
