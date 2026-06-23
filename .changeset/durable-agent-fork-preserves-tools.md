---
'@mastra/core': patch
---

Fixed an issue where publishing instruction-only or model-only overrides could remove tools from request-scoped `createDurableAgent` agents.
Request-scoped agents now stay durable and preserve code-owned tools plus delegated behavior (model and memory).
