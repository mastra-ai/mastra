---
'@mastra/core': minor
---

Added `planTraceAggregate()`. It checks a parsed `aggregateTraces()` request and returns a `TrustedTraceAggregatePlan` that any storage backend can execute without re-validating the request.

```ts
import { parseTraceAggregateRequest, planTraceAggregate } from '@mastra/core/storage';

const plan = planTraceAggregate(parseTraceAggregateRequest(request), {
  scope: { organizationId: 'org_123' },
});
// plan.dimensions, plan.measures, plan.having, plan.orderBy, plan.limit, plan.where
```

**Validation rules**

- `timeRange` and `where` are validated exactly like `queryTraces()`.
- `groupBy` accepts only supported dimensions.
- `countDistinct` accepts `traceId` or any field that `groupBy` accepts.
- `having` can only reference requested measures.
- `orderBy` can reference a requested measure, a requested dimension, or `count`.
- The time range can be at most 365 days.
- An `interval` can produce at most 1000 buckets.

Invalid requests throw `TraceQueryValidationError` with the same issue codes and JSON paths as `planTraceQuery()`. The new `too_many_buckets` code reports an interval that is too small for the time range and names the smallest permitted one.
