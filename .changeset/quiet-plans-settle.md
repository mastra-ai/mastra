---
'@mastra/core': patch
---

Clarified two rules in the `TrustedTraceAggregatePlan` contract that every `aggregateTraces()` backend must follow: null dimension values sort last in both directions, and an empty population returns `rows: []` with no synthesised zero row.
