---
'@mastra/server': patch
---

Corrected the description of `GET /api/workflows/:workflowId/runs/:runId`. It suggested `?fields=status,result,metadata`, but `status` and the metadata fields are always included and the query validator rejects those names with a 400. The example now reads `?fields=result,steps`.
