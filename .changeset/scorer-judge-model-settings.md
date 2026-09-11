---
'@mastra/core': patch
---

Scorer judge configuration now accepts an optional `modelSettings` field (temperature, topP, topK, maxOutputTokens, maxRetries, frequencyPenalty, presencePenalty, timeout, etc.), forwarded to the internal judge agent run. It can be set at the scorer level and overridden per step, removing the need for an input-processor workaround. Closes #23458.
