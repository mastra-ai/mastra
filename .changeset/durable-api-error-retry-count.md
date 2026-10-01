---
'@mastra/core': patch
---

Fixed durable agents reporting `retryCount: 0` to processor hooks after an API-error retry. Hooks like `processInputStep`, `processLLMRequest` and `processOutputStep` now see the same retry count as with a regular `Agent`.
