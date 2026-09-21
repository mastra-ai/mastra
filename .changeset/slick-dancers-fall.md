---
'mastra': minor
---

Added a Resource ID field to the workflow Run Options dialog in Studio. Runs started from Studio are now attributed to that resource and show up in resource-filtered run lists (`GET /api/workflows/:workflowId/runs?resourceId=...`). The value is remembered per workflow, and leaving it empty keeps the previous behavior. When server auth derives the resource ID from the authenticated user, that value still wins. Fixes #24135.

Open a workflow in Studio, click **Run Options**, type a Resource ID such as `tenant-42`, then run the workflow. The run is stored under that resource:

```bash
curl "http://localhost:4111/api/workflows/my-workflow/runs?resourceId=tenant-42"
# { "runs": [ { "runId": "...", "resourceId": "tenant-42", ... } ], "total": 1 }
```
