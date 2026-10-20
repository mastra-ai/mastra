---
'@mastra/client-js': minor
---

Added thread rows, activity sorting and direct filters to `queryTraceThreads()`.

**Breaking type change:** `QueryTraceThreadsResult` now describes full thread rows. Use `QueryTraceThreadsResult<typeof request>` for legacy identity results.

```ts
// Before
await client.queryTraceThreads({ traces: { timeRange: { from, to } } });
// After
await client.queryTraceThreads({ timeRange: { traces: { from, to } } });
```
