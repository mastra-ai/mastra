# @mastra/azure-ai-search

## 0.1.0-alpha.0

### Minor Changes

- Add `@mastra/azure-ai-search`, a vector store backed by Azure AI Search. Use it anywhere Mastra accepts a vector store, including RAG pipelines and Memory semantic recall. Metadata filtering works out of the box: filterable fields are added to the index the first time a metadata key is written (`autoIndexMetadata`, on by default), so Memory's `thread_id`/`resource_id` filters need no schema setup. Any string is accepted as a vector ID. Hybrid (vector + full-text), semantic, and multi-vector queries are available through `hybridQuery()`, `advancedQuery()`, and `multiVectorQuery()`. ([#24103](https://github.com/mastra-ai/mastra/pull/24103))

  ```ts
  import { AzureAISearchVector } from '@mastra/azure-ai-search';

  const store = new AzureAISearchVector({
    id: 'azure-search-vectors',
    endpoint: process.env.AZURE_AI_SEARCH_ENDPOINT!,
    credential: process.env.AZURE_AI_SEARCH_CREDENTIAL!,
  });

  await store.createIndex({ indexName: 'my-collection', dimension: 1536 });
  await store.upsert({ indexName: 'my-collection', vectors: embeddings });
  ```

### Patch Changes

- Updated dependencies [[`697fecc`](https://github.com/mastra-ai/mastra/commit/697feccaa4ad5df913c22e47bf16f493dd7956a8), [`0bf287c`](https://github.com/mastra-ai/mastra/commit/0bf287c36ec14b45f5a4fdd0d279698694f592dd), [`6249741`](https://github.com/mastra-ai/mastra/commit/6249741f8463bdc5a05ded2b35b143f92f33afbf), [`2480359`](https://github.com/mastra-ai/mastra/commit/248035940aa048c7bcd8cfe7845915dc4734b571), [`b26e528`](https://github.com/mastra-ai/mastra/commit/b26e5288891641044a3c26a498c06259985fed10), [`b2f412a`](https://github.com/mastra-ai/mastra/commit/b2f412ae77fa5379471d103ebcc1ba69b22dd353)]:
  - @mastra/core@1.68.0-alpha.4
