---
'@mastra/client-js': minor
---

Added a typed `querySpans()` method that lists completed spans matching a span filter, one row per span, with cursor pagination.

```ts
const result = await mastraClient.querySpans({
  timeRange: { from: '2026-10-01T00:00:00Z', to: '2026-10-02T00:00:00Z' },
  where: { op: 'eq', left: { path: 'spanType' }, right: { literal: 'tool_call' } },
  page: { limit: 50 },
});
// { spans: [...], page: { next } }
```

`queryTraces()` with a `spans.some` filter returns the traces that contain a matching span. `querySpans()` returns the matching spans themselves. Check `capabilities.spanQuery` from `getObservabilityCapabilities()` before you call it.
