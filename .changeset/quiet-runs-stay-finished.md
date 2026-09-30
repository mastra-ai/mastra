---
'@mastra/core': patch
---

Fixed `run.cancel()` overwriting the status of a workflow run that had already finished. Canceling a run that ended as `success`, `failed`, `canceled`, `tripwire` or `bailed` is now a no-op, so its stored status is preserved. This applies to both the default and evented workflow engines, and to the `POST /api/workflows/:workflowId/runs/:runId/cancel` route. ([#25414](https://github.com/mastra-ai/mastra/issues/25414))
