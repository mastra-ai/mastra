---
'@mastra/core': minor
---

Added `planTraceAggregate()` to turn a validated `aggregateTraces()` request into a trusted, backend-independent `TrustedTraceAggregatePlan`. Storage adapters and the reference evaluator work from the plan instead of re-validating the request.

```ts
import { parseTraceAggregateRequest, planTraceAggregate } from '@mastra/core/storage';

const plan = planTraceAggregate(parseTraceAggregateRequest(request), {
  scope: { organizationId: 'org_123' },
});
// plan.dimensions, plan.measures, plan.having, plan.orderBy, plan.limit, plan.where
```

The planner reuses the trace-query selection planner for `timeRange`/`where`, and enforces the rules the request schema leaves to it: only registry dimensions can be grouped, `countDistinct` targets must be `traceId` or a groupable field, `having` and `orderBy` must reference requested measures or dimensions (`count` is always orderable), the window is capped at 365 days, and an `interval` may not produce more than 1000 buckets. Violations throw `TraceQueryValidationError` with the same `issues[]` codes and JSON paths as `planTraceQuery()`, including the new `too_many_buckets` code.
