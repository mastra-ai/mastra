---
'@mastra/core': minor
---

Added explicit dataset experiment execution counts and immutable per-scorer threshold snapshots. Target failures, cancellation, and scorer failures are now counted independently while the existing success, failure, and skipped counters remain available for compatibility.

```ts
const result = await dataset.startExperiment({
  task,
  scorers: [{ scorer: qualityScorer, threshold: 0.8 }],
});

console.log(result.executionStatusCounts);
console.log(result.scorerStatusCounts);
console.log(result.thresholds);
```
