---
'@mastra/rag': minor
---

Add full-text and hybrid search support to `createVectorQueryTool` (#10453).

`createVectorQueryTool` accepts `searchMode` and `hybridConfig`. Fulltext mode skips embedding for faster keyword-only retrieval.

```ts
import { createVectorQueryTool } from '@mastra/rag';

const tool = createVectorQueryTool({
  vectorStoreName: 'pgVector',
  indexName: 'docs',
  model: openai.embedding('text-embedding-3-small'),
  searchMode: 'hybrid',
  hybridConfig: { semanticWeight: 0.7, keywordWeight: 0.3 },
});
```
