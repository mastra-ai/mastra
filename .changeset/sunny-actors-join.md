---
'@mastra/server': patch
---

Fix the `fields` query example in the `GET /api/workflows/:workflowId/runs/:runId` route description. It suggested `?fields=status,result,metadata`, which the validator rejects with a 400; `status` and metadata fields are always included and are not selectable.
