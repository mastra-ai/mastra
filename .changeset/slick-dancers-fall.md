---
'mastra': minor
---

Added a Resource ID field to the workflow Run Options dialog in Studio. Runs started from Studio are now attributed to that resource and show up in resource-filtered run lists (`GET /api/workflows/:workflowId/runs?resourceId=...`). The value is remembered per workflow, and leaving it empty keeps the previous behavior. When server auth derives the resource ID from the authenticated user, that value still wins. Fixes #24135.
