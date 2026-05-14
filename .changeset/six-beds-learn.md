---
'@mastra/core': minor
'@mastra/clickhouse': patch
'@mastra/server': patch
'@mastra/duckdb': patch
---

Observability list endpoints now support stateless delta polling so clients can fetch new data since the last request.

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

**Response shape**
Page-mode responses include `pagination`. Delta-mode responses include `delta` and do not include `pagination`.

```ts
const page = await storage.listTraces({ filters: { entityName: 'agent-1' } });
page.pagination.total;

const delta = await storage.listTraces({
  mode: 'delta',
  filters: { entityName: 'agent-1' },
  after: page.deltaCursor,
  limit: 10,
});
delta.delta.hasMore;
```

**Breaking for typed in-process callers**
- `pagination` is now optional on list responses because it is omitted in delta mode.
- The list arg schemas now use `.strict()`, so extra legacy keys passed directly to storage methods are rejected instead of being ignored.
