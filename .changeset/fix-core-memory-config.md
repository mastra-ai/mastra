---
'@mastra/core': patch
---

Update memory config and exports:

- Updated `SerializedMemoryConfig` to allow `embedder?: EmbeddingModelId | string` for flexibility
- Exported `EMBEDDING_MODELS` and `EmbeddingModelInfo` for use in server endpoints
