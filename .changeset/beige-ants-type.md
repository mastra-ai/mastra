---
'@mastra/core': minor
---

Added the storage contract for span aggregation. Storage adapters can implement `aggregateSpans()` and advertise the `span-aggregate` feature to answer questions like "p95 latency per tool" or "token spend per calling agent" over individual spans.

```ts
class MyObservabilityStore extends ObservabilityStorage {
  getFeatures(): readonly ObservabilityStorageFeature[] {
    return [...(super.getFeatures() ?? []), 'span-aggregate'];
  }

  // `plan` is already validated: tool calls grouped by name, with count and p95 duration
  async aggregateSpans(plan: TrustedSpanAggregatePlan): Promise<SpanAggregateResponse> {
    // e.g. { rows: [{ dimensions: { name: 'search' }, measures: { count: 42, 'duration.p95': 812 } }], truncated: false }
  }
}
```

Span aggregates use the same request shape, measures, and limits as trace aggregates. Filters follow `querySpans()`, so counts match the spans `querySpans()` returns. Spans can be grouped by name, span type, and their own, parent, or root entity. Grouping by model or provider is not supported yet. Token and cost measures count usage on the span that recorded it. Adapters without the feature reject the call as not implemented.
