---
'@mastra/server': patch
---

The `POST /workflows/:workflowId/runs/:runId/cancel` route now responds with a 500 naming the runs that could not be canceled, instead of reporting success. Cancel is safe to retry.
