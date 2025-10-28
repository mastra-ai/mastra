---
title: "Reranking with ZeroEntropy "
description: Example of using Mastra to improve document retrieval relevance with ZeroEntropy's reranking service.
---

# Reranking with ZeroEntropy

```typescript
import {
  rerankWithScorer as rerank,
  ZeroEntropyRelevanceScorer
} from "@mastra/rag";

const results = rerank({
  results: searchResults,
  query: "deployment configuration",
  scorer: new ZeroEntropyRelevanceScorer('zerank-1'),
  {
    topK: 5,
    weights: {
      semantic: 0.4,
      vector: 0.4,
      position: 0.2,
    },
  },
);
```

## Links

- [rerank() reference](/docs/reference/rag/rerankWithScorer)
- [Retrieval docs](/docs/rag/retrieval)
