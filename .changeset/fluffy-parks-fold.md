---
'@mastra/core': minor
'@mastra/pg': minor
'@mastra/clickhouse': minor
'@mastra/duckdb': minor
'@mastra/playground-ui': patch
'@mastra/server': patch
'mastra': patch
---

Added root span details to queryTraces results: name, entityId, parentSpanId, createdAt, metadata, and inputPreview. Trace lists can display these fields without fetching each full trace. createdAt uses the root span start time; inputPreview contains a shortened input preview rather than the full input.

```ts
const { traces } = await client.queryTraces({
  timeRange: { from: '2026-09-01T00:00:00Z', to: '2026-09-15T00:00:00Z' },
});
// Previously required fetching the full trace:
console.log(traces[0]?.name, traces[0]?.inputPreview, traces[0]?.metadata);
```
