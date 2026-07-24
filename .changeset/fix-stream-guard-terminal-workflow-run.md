---
"@mastra/server": patch
---

Fixed `POST /workflows/:workflowId/stream` re-executing a workflow run that had already finished. Because a finished run is dropped from the workflow's in-memory run map — the only thing de-duplicating runIds — streaming that same runId again started a brand-new execution and overwrote the finished run's stored snapshot (a `success` run could silently become `failed`). This made "just re-issue /stream" a destructive reconnection strategy. The route now answers `409` and points at `/observe` for reading a finished run back.
