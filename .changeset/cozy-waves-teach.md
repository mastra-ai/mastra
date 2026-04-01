---
'@mastra/core': minor
---

Added scorer tracing and exported scores through the observability bus.

**What changed**
- Added `SCORER_RUN` and `SCORER_STEP` spans for scorer execution.
- Exported scorer results through `mastra.observability.addScore()` when a target trace is available.
- Added score metadata for scorer name, target entity type, target scope, and scorer trace links.
- Deprecated the legacy scores-store helper while keeping the legacy write path during the transition.

**Why**
This makes scorer execution easier to debug and starts moving scorer results onto the new observability-based score pipeline.

**Example**
```ts
await scorer.run({
  input,
  output,
  scoreSource: 'experiment',
  targetScope: 'span',
  targetTraceId: traceId,
  targetSpanId: spanId,
});
```
