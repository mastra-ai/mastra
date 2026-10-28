---
'@mastra/server': patch
---

Return HTTP 409 Conflict from `POST /agents/:agentId/recover` when the run is no longer active.
