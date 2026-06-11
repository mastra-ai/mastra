# @mastra/voyageai

## 0.1.0-alpha.0

### Minor Changes

- feat(voyageai): add VoyageAI embeddings and reranker integration ([#14296](https://github.com/mastra-ai/mastra/pull/14296))

  Adds the `@mastra/voyageai` package under `embedders/` with:
  - Text embeddings (voyage-4 and voyage-3 series, plus code/finance/law models)
    with token-aware batching via the SDK `tokenize()` method
  - Multimodal embeddings (text + images + video) via voyage-multimodal-3/3.5
  - Contextualized chunk embeddings via voyage-context-3
  - Rerankers (rerank-2.5 and rerank-2 families) implementing `RelevanceScoreProvider`
