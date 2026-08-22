---
'@mastra/core': patch
---

Fixed agent model calls to honor `modelSettings.maxRetries` when no retry count is explicitly configured on the agent or fallback model. Previously the agent's implicit `maxRetries: 0` default overwrote call-time retry settings, which disabled the model-call retry loop (including `Retry-After` handling) entirely. Unconfigured agents now fall back to the execution-layer default of 2 retries; explicitly setting `maxRetries: 0` on the agent or a fallback model still disables retries.
