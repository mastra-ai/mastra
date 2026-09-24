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
- `having` can reference a requested measure or `count`.
- `orderBy` can reference a requested measure, a requested dimension, or `count`. `bucket` is not an ordering target.
- The time range can be at most 365 days.
- An `interval` can touch at most 1000 UTC-aligned buckets, and `limit × buckets` can be at most 10,000 rows.

`having`, `orderBy`, and `limit` apply to groups using measures computed over the whole time range; with an `interval`, each returned group is a complete series in bucket order. The plan's JSDoc spells this out for backends.

Invalid requests throw `TraceQueryValidationError` with the same issue codes and JSON paths as `planTraceQuery()`. The new `too_many_buckets` code names the smallest permitted interval; `too_many_rows` asks the caller to lower `limit` or widen `interval`.
