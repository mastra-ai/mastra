---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/playground-ui': minor
'@mastra/clickhouse': minor
'@mastra/dsql': minor
'@mastra/duckdb': minor
'@mastra/libsql': minor
'@mastra/mongodb': minor
'@mastra/mssql': minor
'@mastra/mysql': minor
'@mastra/pg': minor
'@mastra/spanner': minor
---

Added server-side duration sorting for observability trace and branch lists.

The observability APIs now accept `orderBy: { field: 'durationMs' }`, and the playground Total Time column asks the server for that ordering so paginated lists stay globally sorted.

```ts
await client.listTraces({
  pagination: { page: 0, perPage: 25 },
  orderBy: { field: 'durationMs', direction: 'DESC' },
});
```
