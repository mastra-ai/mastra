---
'@mastra/core': patch
---

Add declarative eligibility filters to scorer bindings, evaluated before sampling.

A scorer binding can now declare `filter`, a JSON-safe predicate over the scoring context (`requestContext`, `entity`, `entityType`, `source`, `threadId`, `resourceId`, `projectId`) using the shared predicate DSL. Filters run before sampling, so the sampling rate applies to qualifying traffic only — e.g. score escalated conversations at 100% by filtering on `requestContext.escalated` in one binding, and sample the rest at 5% in another.

```ts
scorers: {
  groundedness: {
    scorer: groundednessScorer,
    filter: {
      op: 'eq',
      left: { path: 'requestContext.protocolVersion' },
      right: { literal: 'v3' },
    },
    sampling: { type: 'ratio', rate: 0.05 },
  },
}
```

Details:

- Filters are validated at definition time: paths referencing unknown roots throw at agent construction (or when function-based scorer configs resolve), instead of silently skipping all scoring at runtime.
- Filters evaluate against the flattened `requestContext` view that is persisted on score rows, so a filter remains answerable against stored records.
- Filters are plain JSON and survive durable-agent serialization round-trips unchanged.
- Scoring filters use the same predicate format as workflow `conditional`/`loop` conditions; existing workflow predicate behavior is unchanged.
- Fixed: an unrecognized `sampling.type` previously fell through to scoring 100% of traffic; it now fails closed and skips scoring.
