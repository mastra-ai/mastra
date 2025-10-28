---
title: "ZeroEntropy を用いたリランキング"
description: ZeroEntropy のリランキングサービスを使用して、Mastra でドキュメント検索の関連性を高める例。
---

# ZeroEntropy を使ったリランキング \{#reranking-with-zeroentropy\}

```typescript
import {
  rerankWithScorer as rerank,
  ZeroEntropyRelevanceScorer
} from "@mastra/rag";

const results = rerank({
  results: searchResults,
  query: "デプロイ設定",
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

## リンク \{#links\}

* [rerank() リファレンス](/docs/reference/rag/rerankWithScorer)
* [検索（Retrieval）に関するドキュメント](/docs/rag/retrieval)