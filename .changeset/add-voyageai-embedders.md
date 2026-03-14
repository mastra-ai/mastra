---
"@mastra/voyageai": minor
"@mastra/core": patch
---

feat(voyageai): add VoyageAI embeddings and reranker integration

Adds `@mastra/voyageai` package under `embedders/` with:
- Text embeddings (voyage-4 series, voyage-3 series, code/finance/law models)
- Token-aware batching using VoyageAI SDK's `tokenize()` for automatic input splitting
- Multimodal embeddings (text + images + video)
- Contextualized chunk embeddings with document context
- Reranker support (rerank-2.5, rerank-2 series)
- ModelRouter integration in `@mastra/core` for `voyage/model-id` format
