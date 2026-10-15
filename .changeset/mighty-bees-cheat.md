---
'@mastra/client-js': minor
---

Added `aggregateTraces()` to group and measure traces from the client. Check `capabilities.traceAggregate` from `getObservabilityCapabilities()` before calling it.

```typescript
const { rows } = await mastraClient.aggregateTraces({
  timeRange: { from: '2026-08-01T00:00:00.000Z', to: '2026-08-08T00:00:00.000Z' },
  groupBy: ['entityName'],
  measures: ['count', 'duration.p95'],
});
```
