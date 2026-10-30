---
'@mastra/server': minor
'@mastra/client-js': minor
---

Added the `aggregateTimeToFirstMeasures` observability capability. Trace and span aggregate requests for `timeToFirstToken.*` or `timeToFirstChunk.*` measures now return `501` against stores that can't compute them, and field discovery omits those measures for such stores.

```typescript
const { capabilities } = await mastraClient.getObservabilityCapabilities();

if (capabilities.traceAggregate && capabilities.aggregateTimeToFirstMeasures) {
  const { rows } = await mastraClient.aggregateTraces({
    timeRange: { from: '2026-08-01T00:00:00.000Z', to: '2026-08-02T00:00:00.000Z' },
    groupBy: ['entityName'],
    measures: ['timeToFirstChunk.p95', 'timeToFirstChunk.count'],
  });
}
```
