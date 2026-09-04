---
'@mastra/server': minor
---

Added `PATCH /api/datasets/:datasetId/experiments/:experimentId` to update an experiment's name, description, or metadata. Returns the updated experiment, `404` when the experiment does not exist in that dataset, and `400` for unknown body fields.
