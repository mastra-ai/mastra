---
'@mastra/core': minor
---

Added root-duration ordering to the advanced trace-query contract. `orderBy` now accepts `durationMs` alongside `startedAt` and `endedAt`, ordering completed traces by their root span's duration with deterministic `traceId` tie-breaks and numeric keyset cursors that stay valid alongside existing timestamp cursors.

Duration ordering is off by default: `planTraceQuery` rejects it with a structured `order_field_not_supported` issue unless the host opts in after confirming its storage adapter advertises the new `trace-query-root-duration-ordering` capability.

```ts
const plan = planTraceQuery(
  parseTraceQueryRequest({
    timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-08-31T00:00:00Z' },
    orderBy: [{ field: 'durationMs', direction: 'desc' }],
  }),
  { allowRootDurationOrdering: true },
);
```
