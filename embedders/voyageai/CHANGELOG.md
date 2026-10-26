# @mastra/voyageai

## 0.4.3-alpha.0

### Patch Changes

- dependencies updates: ([#28417](https://github.com/mastra-ai/mastra/pull/28417))
  - Updated dependency [`@types/node@22.19.15` ↗︎](https://www.npmjs.com/package/@types/node/v/22.19.15) (from `22.20.5`, in `devDependencies`)

## 0.4.2

### Patch Changes

- Added support for the `voyage-code-4` code embedding model. It defaults to 1024 dimensions and also supports 256, 512 and 2048. ([#27761](https://github.com/mastra-ai/mastra/pull/27761))

  ```typescript
  import { createVoyageTextEmbedding } from '@mastra/voyageai';

  const embedder = createVoyageTextEmbedding({ model: 'voyage-code-4', inputType: 'document' });
  ```

- Bump for npm ([#27221](https://github.com/mastra-ai/mastra/pull/27221))

## 0.4.2-alpha.1

### Patch Changes

- Added support for the `voyage-code-4` code embedding model. It defaults to 1024 dimensions and also supports 256, 512 and 2048. ([#27761](https://github.com/mastra-ai/mastra/pull/27761))

  ```typescript
  import { createVoyageTextEmbedding } from '@mastra/voyageai';

  const embedder = createVoyageTextEmbedding({ model: 'voyage-code-4', inputType: 'document' });
  ```

## 0.4.2-alpha.0

### Patch Changes

- Bump for npm ([#27221](https://github.com/mastra-ai/mastra/pull/27221))

## 0.4.1

### Patch Changes

- Update README to include accurate, up-to-date information ([#22858](https://github.com/mastra-ai/mastra/pull/22858))

- Remove `CHANGELOG.md` from distributed npm files resulting in reduced package size ([#22737](https://github.com/mastra-ai/mastra/pull/22737))

## 0.4.1-alpha.1

### Patch Changes

- Update README to include accurate, up-to-date information ([#22858](https://github.com/mastra-ai/mastra/pull/22858))

## 0.4.1-alpha.0

### Patch Changes

- Remove `CHANGELOG.md` from distributed npm files resulting in reduced package size ([#22737](https://github.com/mastra-ai/mastra/pull/22737))

## 0.4.0

### Minor Changes

- Fixed VoyageAI multimodal embeddings sending text as bare strings (the API rejected the payload) and added a `baseUrl` option so you can point the embedder, reranker, and contextualized models at a provider-hosted Voyage endpoint. ([#19804](https://github.com/mastra-ai/mastra/pull/19804))

  **Before**

  ```ts
  // multimodal text was serialized as inputs: [["text"]] -> HTTP 400
  ```

  **After**

  ```ts
  const embedder = voyage.multimodalEmbedding({
    model: 'voyage-multimodal-3.5',
    baseUrl: 'https://ai.mongodb.com/v1',
  });
  ```

## 0.4.0-alpha.0

### Minor Changes

- Fixed VoyageAI multimodal embeddings sending text as bare strings (the API rejected the payload) and added a `baseUrl` option so you can point the embedder, reranker, and contextualized models at a provider-hosted Voyage endpoint. ([#19804](https://github.com/mastra-ai/mastra/pull/19804))

  **Before**

  ```ts
  // multimodal text was serialized as inputs: [["text"]] -> HTTP 400
  ```

  **After**

  ```ts
  const embedder = voyage.multimodalEmbedding({
    model: 'voyage-multimodal-3.5',
    baseUrl: 'https://ai.mongodb.com/v1',
  });
  ```

## 0.3.0

### Minor Changes

- Added support for the `voyage-context-4` contextualized chunk embedding model (preview). Each chunk is embedded with awareness of the other chunks in the same document, capturing both local detail and document-level context. Supports flexible output dimensions (256, 512, 1024, 2048). ([#18413](https://github.com/mastra-ai/mastra/pull/18413))

  ```typescript
  import { voyage, voyageContextualizedEmbedding } from '@mastra/voyageai';

  // Pre-configured model
  const result = await voyage.context4.doEmbed({
    values: [['Paragraph 1 from doc 1...', 'Paragraph 2 from doc 1...'], ['Content from doc 2...']],
    inputType: 'document',
  });

  // Or configure explicitly
  const model = voyageContextualizedEmbedding({ model: 'voyage-context-4', outputDimension: 512 });
  ```

## 0.3.0-alpha.0

### Minor Changes

- Added support for the `voyage-context-4` contextualized chunk embedding model (preview). Each chunk is embedded with awareness of the other chunks in the same document, capturing both local detail and document-level context. Supports flexible output dimensions (256, 512, 1024, 2048). ([#18413](https://github.com/mastra-ai/mastra/pull/18413))

  ```typescript
  import { voyage, voyageContextualizedEmbedding } from '@mastra/voyageai';

  // Pre-configured model
  const result = await voyage.context4.doEmbed({
    values: [['Paragraph 1 from doc 1...', 'Paragraph 2 from doc 1...'], ['Content from doc 2...']],
    inputType: 'document',
  });

  // Or configure explicitly
  const model = voyageContextualizedEmbedding({ model: 'voyage-context-4', outputDimension: 512 });
  ```

## 0.2.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))

## 0.2.0-alpha.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))

## 0.1.1

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

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
