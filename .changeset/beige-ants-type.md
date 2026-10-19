---
'@mastra/core': minor
---

Added the storage contract for span aggregation. Storage adapters can implement `aggregateSpans()` and advertise the `span-aggregate` feature to answer questions like "p95 latency per tool" or "token spend per calling agent" over individual spans.

```ts
import { planSpanAggregate } from '@mastra/core/storage';

const plan = planSpanAggregate({
  timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-08-08T00:00:00Z' },
  where: { op: 'eq', left: { path: 'spanType' }, right: { literal: 'tool_call' } },
  groupBy: ['name', 'rootEntityName'],
  measures: ['count', 'duration.p95', 'errorRate'],
});
const { rows } = await observabilityStore.aggregateSpans(plan);
```

Span aggregates use the same request shape, measures, and limits as trace aggregates. Filters follow `querySpans()`, so counts match the spans `querySpans()` returns. Spans can be grouped by name, span type, and their own, parent, or root entity. Grouping by model or provider is not supported yet. Token and cost measures count usage on the span that recorded it. Adapters without the feature reject the call as not implemented.
