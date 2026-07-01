---
'@mastra/core': minor
---

Added `scoreTraceBatch()` to `@mastra/core/evals/scoreTraces` for scoring multiple stored traces with one scorer instance while keeping per-target success and failure results.

`scoreTrace()` now also accepts either a stored trace reference or a preloaded `TraceRecord`, and it returns the persisted `ScoreRowData` so callers can use the saved score directly after the write.

**Why**

This makes baseline-style scoring easier to run from callers that already have a scorer instance and shared batch metadata, without widening the existing workflow-based `scoreTraces()` API.

**Before**

```ts
for (const target of targets) {
  await scoreTrace({
    storage,
    scorer,
    target,
    batchId,
    datasetId,
    datasetItemId: target.datasetItemId,
  });
}
```

**After**

```ts
const result = await scoreTraceBatch({
  storage,
  scorer,
  targets,
  batchId,
  datasetId,
});

const savedScore = await scoreTrace({
  storage,
  scorer,
  target: { trace: preloadedTrace, spanId },
  batchId,
  datasetId,
  datasetItemId,
});
```
