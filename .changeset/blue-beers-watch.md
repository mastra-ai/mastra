---
'@mastra/core': patch
---

Fixed durable agents passing `stepNumber: 0` and an empty `steps` list to `processLLMRequest`, `processLLMResponse`, and `processOutputStep` on every step. Processor hooks now receive the correct zero-based step index and the running step list, matching non-durable agents. Fixes #24279
