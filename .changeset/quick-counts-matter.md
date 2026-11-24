---
'@mastra/core': patch
---

Fixed `dataset.createExperiment()` and `dataset.startExperimentAsync()` loading every dataset item only to count them. Creating an experiment now asks storage for the count, so it stays fast on large datasets. Fixes [#31083](https://github.com/mastra-ai/mastra/issues/31083).
