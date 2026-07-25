---
"@mastra/server": patch
---

Fixed `POST /workflows/:workflowId/stream` restarting a workflow run that had already finished, which could overwrite its stored result. Streaming a finished run now returns `409` instead. Read a finished run's result through `POST /workflows/:workflowId/observe`.
