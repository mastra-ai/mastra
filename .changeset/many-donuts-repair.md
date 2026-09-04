---
'@mastra/server': minor
---

Added experiment deletion routes. `DELETE /api/datasets/:datasetId/experiments/:experimentId` deletes an experiment that belongs to a dataset, and `DELETE /api/experiments/:experimentId` deletes any experiment, including orphaned experiments whose dataset was already deleted. Both routes cascade-delete the experiment's results and respect tenancy scoping.

By default they also delete the traces the experiment produced, cascading to their spans and trace-linked scores, feedback, metrics and logs. Pass `?deleteTraces=false` to keep the traces. Stores without an observability domain (or without tenant-scoped trace deletion) log a warning and skip the trace cascade so the experiment is still deleted.
