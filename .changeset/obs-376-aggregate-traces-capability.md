---
'@mastra/core': minor
---

Storage adapters that support the new `trace-aggregate` capability can return aggregated trace results through `ObservabilityStorage.aggregateTraces()`, which executes a `TrustedTraceAggregatePlan` and returns a `TraceAggregateResponse`. The capability is declared alongside `trace-query`. Adapters that do not support it reject the call with a `MastraError` whose id is `OBSERVABILITY_STORAGE_AGGREGATE_TRACES_NOT_IMPLEMENTED`.

```ts
import { parseTraceAggregateRequest, planTraceAggregate } from '@mastra/core/storage';

const plan = planTraceAggregate(
  parseTraceAggregateRequest({
    timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' },
    measures: ['count'],
  }),
);

const response = await storage.aggregateTraces(plan);
```
