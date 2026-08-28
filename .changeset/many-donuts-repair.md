---
'@mastra/server': minor
---

Added experiment deletion routes. `DELETE /api/datasets/:datasetId/experiments/:experimentId` deletes an experiment that belongs to a dataset, and `DELETE /api/experiments/:experimentId` deletes any experiment, including orphaned experiments whose dataset was already deleted. Both routes cascade-delete the experiment's results and respect tenancy scoping.
