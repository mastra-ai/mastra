---
'@mastra/core': patch
---

Exported `GatewayManager` from `@mastra/core/llm` and added `GatewayManager.hasProviderAuth()` plus `ModelRouterLanguageModel.hasAuth()`, so a server can ask the same gateway auth chain the model router uses at run time.
