# @mastra/weaviate

## 0.1.0-alpha.0

### Minor Changes

- Add `@mastra/weaviate`, a vector store backed by [Weaviate](https://weaviate.io/). The `WeaviateVector` class implements the full `MastraVector` contract (createIndex, upsert, query, listIndexes, describeIndex, deleteIndex, updateVector, deleteVector, deleteVectors) against `vectorizer: none` collections, with cosine/euclidean/dotproduct distance metrics and MongoDB-style metadata filtering ($eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $all, $exists, $and, $or, $not). Arbitrary vector ids are preserved via a deterministic UUIDv5 mapping, and the original index name is preserved despite Weaviate's collection-name capitalization. Supports local Docker and Weaviate Cloud deployments. ([#24043](https://github.com/mastra-ai/mastra/pull/24043))

  ```ts
  import { WeaviateVector } from '@mastra/weaviate';

  const store = new WeaviateVector({ id: 'weaviate', httpHost: 'localhost', httpPort: 8080 });

  await store.createIndex({ indexName: 'documents', dimension: 1536, metric: 'cosine' });
  await store.upsert({ indexName: 'documents', vectors: embeddings, metadata: [{ text: 'hello' }] });

  const results = await store.query({ indexName: 'documents', queryVector, topK: 5 });
  ```

### Patch Changes

- Updated dependencies [[`81ccd7b`](https://github.com/mastra-ai/mastra/commit/81ccd7b93040952fe9c7168a2757c43a217f0a87), [`a46385d`](https://github.com/mastra-ai/mastra/commit/a46385dc1b773d1e1453627b1d62e7b6ebe93cf1), [`164e197`](https://github.com/mastra-ai/mastra/commit/164e197aa5b0973ae49a82252294f6276b2829aa), [`25d940a`](https://github.com/mastra-ai/mastra/commit/25d940add25504daebe65bc5cc02f268d6eba07c), [`b483910`](https://github.com/mastra-ai/mastra/commit/b48391034dee9a19396c1b3ec084ecf20faf550e), [`164e197`](https://github.com/mastra-ai/mastra/commit/164e197aa5b0973ae49a82252294f6276b2829aa), [`fa4c366`](https://github.com/mastra-ai/mastra/commit/fa4c3664c5446ae13d991204275883b2d7f00690), [`164e197`](https://github.com/mastra-ai/mastra/commit/164e197aa5b0973ae49a82252294f6276b2829aa), [`1670091`](https://github.com/mastra-ai/mastra/commit/16700919c35dadb9737dc7fe7e5feb67cc209494), [`b8e3ee5`](https://github.com/mastra-ai/mastra/commit/b8e3ee5da5cbc46b182ca75214acda667bac5205), [`d777788`](https://github.com/mastra-ai/mastra/commit/d7777889d72b4f37a3d50b830f8208c736ee0e7a), [`56680bf`](https://github.com/mastra-ai/mastra/commit/56680bfff71e7cdad71721b424b160bdd5de6e02), [`93a3425`](https://github.com/mastra-ai/mastra/commit/93a342569d592d0449eee7b4b4f7555dc001081b), [`b130872`](https://github.com/mastra-ai/mastra/commit/b130872508e95f17894c2ed4932d4952db0a2d3c), [`1853f3d`](https://github.com/mastra-ai/mastra/commit/1853f3d9331e3131930581556df781cca85f2d2d), [`fdb59c6`](https://github.com/mastra-ai/mastra/commit/fdb59c6a4c3d9aea19159886aac8d80602763f04)]:
  - @mastra/core@1.68.0-alpha.1
