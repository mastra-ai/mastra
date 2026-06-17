# @mastra/voyageai

## 0.1.1-alpha.0

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

## 0.1.0

### Minor Changes

- feat(voyageai): add VoyageAI embeddings and reranker integration ([#14296](https://github.com/mastra-ai/mastra/pull/14296))

  Adds the `@mastra/voyageai` package under `embedders/` with:
  - Text embeddings (voyage-4 and voyage-3 series, plus code/finance/law models)
    with token-aware batching via the SDK `tokenize()` method
  - Multimodal embeddings (text + images + video) via voyage-multimodal-3/3.5
  - Contextualized chunk embeddings via voyage-context-3
  - Rerankers (rerank-2.5 and rerank-2 families) implementing `RelevanceScoreProvider`

## 0.1.0-alpha.0

### Minor Changes

- feat(voyageai): add VoyageAI embeddings and reranker integration ([#14296](https://github.com/mastra-ai/mastra/pull/14296))

  Adds the `@mastra/voyageai` package under `embedders/` with:
  - Text embeddings (voyage-4 and voyage-3 series, plus code/finance/law models)
    with token-aware batching via the SDK `tokenize()` method
  - Multimodal embeddings (text + images + video) via voyage-multimodal-3/3.5
  - Contextualized chunk embeddings via voyage-context-3
  - Rerankers (rerank-2.5 and rerank-2 families) implementing `RelevanceScoreProvider`
