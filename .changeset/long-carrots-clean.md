---
'@mastra/pg': minor
'@mastra/clickhouse': minor
'@mastra/duckdb': minor
---

Added support for `timeToFirstToken.*` and `timeToFirstChunk.*` measures in trace and span aggregates. Rows without a recorded value are skipped, never counted as 0.

```typescript
import { planSpanAggregate } from '@mastra/core/storage';

const observability = await storage.getStore('observability');

if (observability?.getFeatures().includes('aggregate-time-to-first-measures')) {
  const { rows } = await observability.aggregateSpans(
    planSpanAggregate({
      timeRange: { from: '2026-08-01T00:00:00.000Z', to: '2026-08-02T00:00:00.000Z' },
      where: { op: 'eq', left: { path: 'spanType' }, right: { literal: 'model_inference' } },
      measures: ['timeToFirstToken.p50', 'timeToFirstToken.p95'],
    }),
  );
}
```
