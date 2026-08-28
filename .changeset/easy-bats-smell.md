---
'@mastra/server': patch
---

Added DELETE /api/observability/feedback and DELETE /api/observability/scores routes for deleting feedback and score records by id, gated behind the observability-signal-deletion core feature and the observability:delete permission.
