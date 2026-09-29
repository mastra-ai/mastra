---
'@mastra/server': minor
---

Added `POST /observability/traces/aggregate`, which returns grouped and optionally time-bucketed trace measures such as counts, duration percentiles, and error rates. The endpoint requires the `observability:read` permission and uses the same error contract as `POST /observability/traces/query`: malformed JSON returns 400, invalid queries return 422 with structured `issues`, and execution timeouts return 504. Observability stores that do not support the `trace-aggregate` capability return 501 with code `TRACE_AGGREGATE_UNSUPPORTED`.

```ts
const response = await fetch('/api/observability/traces/aggregate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' },
    groupBy: ['entityName'],
    interval: '1d',
    measures: ['count', 'duration.p95', 'errorRate'],
  }),
});
// { rows: [{ dimensions, bucket, measures }], truncated }
```
