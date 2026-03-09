---
'@mastra/core': minor
---

Add full-text and hybrid search types for RAG vector queries (#10453).

Vector search alone misses keyword-specific queries. Use `'fulltext'` for exact keyword matches without embeddings, `'vector'` for semantic similarity (default), or `'hybrid'` to combine both for better recall.

- `QueryVectorParams`: new `searchMode`, `queryText`, `hybridConfig` fields
- `UpsertVectorParams`: new `documents` field for storing raw text
- New types: `SearchMode`, `HybridConfig`

```ts
import type { SearchMode, HybridConfig } from '@mastra/core/vector';

const params: QueryVectorParams = {
  indexName: 'docs',
  queryVector: embedding,
  searchMode: 'hybrid',
  queryText: 'authentication middleware',
  hybridConfig: { semanticWeight: 0.7, keywordWeight: 0.3 },
  topK: 10,
};
```
