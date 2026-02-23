---
'@mastra/core': minor
---

Add full-text and hybrid search types for RAG vector queries (#10453).

New types on `QueryVectorParams`: `searchMode`, `queryText`, `hybridConfig`. New field on `UpsertVectorParams`: `documents`. New `SearchMode` type (`'vector'` | `'fulltext'` | `'hybrid'`) and `HybridConfig` interface let users choose keyword-based, semantic, or combined retrieval.

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
