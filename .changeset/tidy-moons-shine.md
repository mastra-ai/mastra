---
'@mastra/core': patch
---

Make `ProviderModelsMap` augmentable so custom gateways can register their providers and models. It is now declared as an exported interface on `@mastra/core/llm`, so `declare module '@mastra/core/llm'` augmentation flows through to `Provider`, `ModelForProvider` and `ModelRouterModelId`.
