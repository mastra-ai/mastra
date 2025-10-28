---
title: "Cohere によるリランキング"
description: Mastra を使い、Cohere のリランキングサービスでドキュメント検索の関連性を高める例。
---

# Cohere によるリランキング \{#reranking-with-cohere\}

RAG のためにドキュメントを取得する際、初期のベクトル類似度検索では重要な意味的な一致を見落とすことがあります。

Cohere のリランキングサービスは、複数のスコアリング要因に基づいてドキュメントの順位を付け直し、結果の関連性を高めます。

```typescript
import {
  rerankWithScorer as rerank,
  CohereRelevanceScorer
} from "@mastra/rag";

const results = rerank({
  results: searchResults,
  query: "デプロイ設定",
  scorer: new CohereRelevanceScorer('rerank-v3.5'),
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
* [リトリーバルのドキュメント](/docs/rag/retrieval)