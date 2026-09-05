---
'@mastra/core': minor
---

`dataset.deleteExperiment()` now also deletes the observability traces the experiment produced, cascading to their spans and trace-linked scores, feedback, metrics and logs. Experiment traces are excluded from normal trace reads, so leaving them behind kept data that was invisible but still retained.

`mastra.datasets.deleteExperiment()` is new and does the same thing without requiring the experiment to still belong to a dataset, so experiments orphaned by dataset deletion can be cleaned up.

```ts
// Both delete the experiment, its results, and its traces.
await dataset.deleteExperiment({ experimentId });
await mastra.datasets.deleteExperiment({ experimentId });
```

Stores without an observability domain (or without tenant-scoped trace deletion) log a warning and skip the trace cascade so the experiment is still deleted.
