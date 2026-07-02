---
'@mastra/core': minor
---

Added `scoreTrace()` and `scoreTraceBatch()` to `@mastra/core/evals/scoreTraces` for scoring stored traces without re-running the agent.

- `scoreTrace()` can score either a stored trace reference or a preloaded `TraceRecord`, and it returns the persisted `ScoreRowData` after the write.
- `scoreTraceBatch()` runs one scorer instance across multiple stored traces with bounded concurrency and returns per-target success and failure results.

**Why**

This gives baseline-style callers a small public API for persisted trace scoring when they already have a scorer instance, without widening the existing workflow-based `scoreTraces()` API.

**Before**

```ts
await scoreTraces({
  mastra,
  scorerId: 'helpfulness',
  targets: [{ traceId, spanId }],
});
```

**After**

```ts
import { scoreTrace, scoreTraceBatch } from '@mastra/core/evals/scoreTraces';

const savedScore = await scoreTrace({
  storage,
  scorer,
  target: { trace: preloadedTrace, spanId },
  batchId,
  datasetId,
  datasetItemId,
});

const result = await scoreTraceBatch({
  storage,
  scorer,
  targets,
  batchId,
  datasetId,
});
```
