---
'@mastra/core': minor
---

`dataset.deleteExperiment()` now also deletes the observability traces the experiment produced, cascading to their spans and trace-linked scores, feedback, metrics and logs. Experiment traces are excluded from normal trace reads, so leaving them behind kept data that was invisible but still retained.

```ts
// Deletes the experiment, its results, and its traces.
await dataset.deleteExperiment({ experimentId });

// Deletes only the experiment and its results.
await dataset.deleteExperiment({ experimentId, deleteTraces: false });
```

Stores without an observability domain (or without tenant-scoped trace deletion) log a warning and skip the trace cascade so the experiment is still deleted.
