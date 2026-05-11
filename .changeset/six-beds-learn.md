.changeset/six-beds-learn.md---
'@mastra/core': minor
'@mastra/clickhouse': patch
'@mastra/server': patch
'@mastra/duckdb': patch
---

Observability list endpoints now support stateless delta polling so clients can fetch only new data since the last request.

```ts
const page = await client.observability.listTraces({
  mode: 'page',
  filters: { entityName: 'agent-1' },
});

const delta = await client.observability.listTraces({
  mode: 'delta',
  filters: { entityName: 'agent-1' },
  after: page.deltaCursor,
});
```
