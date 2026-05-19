---
'@mastra/server': minor
'@mastra/client-js': minor
---

Added delta polling support for observability list endpoints.

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

Use `mode: 'delta'` to fetch only new items after the last cursor.

Page-mode responses include `pagination` and `deltaCursor` when delta polling is supported. Delta-mode responses include `delta` and do not include `pagination`.

If you read these responses directly in typed code, note that `pagination` is only included in page mode.
