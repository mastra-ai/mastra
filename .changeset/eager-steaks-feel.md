---
'@mastra/core': patch
---

Added `AgentController.getModelAuthStatus(modelId)`, which reports whether a model provider has credentials configured, for any model id. It does not need the model catalog, so it also works when catalog discovery fails.
