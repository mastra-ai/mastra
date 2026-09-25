---
'@mastra/server': minor
---

Added a `summary` query parameter to `GET /workflows/:workflowId/runs`. With `summary=true`, each run snapshot is reduced to `{ status, timestamp }`, keeping run lists small when snapshots are large.

```
GET /api/workflows/my-workflow/runs?summary=true
```
