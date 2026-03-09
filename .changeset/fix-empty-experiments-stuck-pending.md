---
'@mastra/core': patch
'@mastra/playground-ui': patch
---

Fixed experiments getting stuck in "pending" status when triggered on datasets with zero items. `startExperimentAsync` now validates item count before creating the experiment record and throws `EXPERIMENT_NO_ITEMS`. The fire-and-forget catch handler now marks experiments as failed instead of silently discarding errors. The trigger API returns HTTP 400 for empty datasets, and the UI disables the Run Experiment button when a dataset has no items.
