---
'@mastra/core': minor
---

Added `aggregateTraces()` to `ObservabilityStorage` and the `trace-aggregate` storage capability, declared alongside `trace-query`. The base implementation fails closed with a `MastraError` whose id is `OBSERVABILITY_STORAGE_AGGREGATE_TRACES_NOT_IMPLEMENTED`; storage backends that advertise `trace-aggregate` override it to execute a `TrustedTraceAggregatePlan` and return a `TraceAggregateResponse`.

```ts
import type { ObservabilityStorageFeature } from '@mastra/core/storage';

const feature: ObservabilityStorageFeature = 'trace-aggregate';
// storage.aggregateTraces(plan) rejects on stores that do not implement it
```
