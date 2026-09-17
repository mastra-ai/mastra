---
'@mastra/duckdb': minor
---

Added DuckDB support for handing numbered trace-query pages to delta polling. The initial page and polling watermark share a snapshot, and polls detect completed root writes.

```ts
// Start with a numbered page.
const page = await client.queryTraces({ timeRange, pagination: { page: 0, perPage: 100 } });
// Continue with delta polling.
const delta = await client.queryTraces({ timeRange, mode: 'delta', after: page.deltaCursor });
```
