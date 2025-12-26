---
'@mastra/core': patch
'@mastra/memory': patch
'@mastra/fastembed': patch
---

Added support for AI SDK v6 embedding models (specification version v3) in memory and vector modules. Fixed TypeScript error where `ModelRouterEmbeddingModel` was trying to implement a union type instead of `EmbeddingModelV2` directly.

