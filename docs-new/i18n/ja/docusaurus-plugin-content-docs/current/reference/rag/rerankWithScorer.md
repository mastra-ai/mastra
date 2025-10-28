---
title: "リファレンス: Rerank"
description: Mastra の rerank 関数に関するドキュメント。ベクター検索結果の高度な再ランキング機能を提供します。
---

# rerankWithScorer() \{#rerankwithscorer\}

`rerankWithScorer()` 関数は、セマンティック関連性、ベクトル類似度、位置ベースのスコアリングを組み合わせて、ベクトル検索結果を高度に再ランキングします。

```typescript
function rerankWithScorer({
  results: QueryResult[],
  query: string,
  scorer: RelevanceScoreProvider,
  options?: RerankerFunctionOptions,
}): Promise<RerankResult[]>;
```

## 使い方の例 \{#usage-example\}

```typescript
import { openai } from '@ai-sdk/openai';
import { rerankWithScorer as rerank, CohereRelevanceScorer } from '@mastra/rag';

const scorer = new CohereRelevanceScorer('rerank-v3.5');

const rerankedResults = await rerank({
  results: vectorSearchResults,
  query: '本番環境へのデプロイ方法は？',
  scorer,
  options: {
    weights: {
      semantic: 0.5,
      vector: 0.3,
      position: 0.2,
    },
    topK: 3,
  },
});
```

## パラメーター \{#parameters\}

<PropertiesTable
  content={[
{
name: "results",
type: "QueryResult[]",
description: "再ランキングするベクター検索結果",
isOptional: false,
},
{
name: "query",
type: "string",
description: "関連性の評価に用いる検索クエリのテキスト",
isOptional: false,
},
{
name: "scorer",
type: "RelevanceScoreProvider",
description: "再ランキングに使用する関連性スコアラー",
isOptional: false,
},
{
name: "options",
type: "RerankerFunctionOptions",
description: "再ランキングモデルのオプション",
isOptional: true,
},
]}
/>

`rerankWithScorer` 関数は、@mastra/rag の任意の `RelevanceScoreProvider` を受け付けます。

> 注意: 再ランキング時にセマンティック評価が正しく機能するためには、各結果に `metadata.text` フィールドでテキストコンテンツを含めてください。

### RerankerFunctionOptions \{#rerankerfunctionoptions\}

<PropertiesTable
  content={[
{
name: "weights",
type: "WeightConfig",
description:
"各スコアリング要素の重み（合計が1になる必要があります）",
isOptional: true,
properties: [
{
type: "number",
parameters: [
{
name: "semantic",
description: "意味的関連度の重み",
isOptional: true,
type: "number（デフォルト: 0.4）",
},
],
},
{
type: "number",
parameters: [
{
name: "vector",
description: "ベクトル類似度の重み",
isOptional: true,
type: "number（デフォルト: 0.4）",
},
],
},
{
type: "number",
parameters: [
{
name: "position",
description: "位置ベースのスコアリングの重み",
isOptional: true,
type: "number（デフォルト: 0.2）",
},
],
},
],
},
{
name: "queryEmbedding",
type: "number[]",
description: "クエリの埋め込み（Embedding）",
isOptional: true,
},
{
name: "topK",
type: "number",
description: "返す上位結果の数",
isOptional: true,
defaultValue: "3",
},
]}
/>

## 戻り値 \{#returns\}

この関数は `RerankResult` オブジェクトの配列を返します：

<PropertiesTable
  content={[
{
name: "result",
type: "QueryResult",
description: "元のクエリ結果",
},
{
name: "score",
type: "number",
description: "再ランク付けの総合スコア（0～1）",
},
{
name: "details",
type: "ScoringDetails",
description: "スコアリングの詳細情報",
},
]}
/>

### ScoringDetails \{#scoringdetails\}

<PropertiesTable
  content={[
{
name: "semantic",
type: "number",
description: "セマンティック関連度スコア (0〜1)",
},
{
name: "vector",
type: "number",
description: "ベクトル類似度スコア (0〜1)",
},
{
name: "position",
type: "number",
description: "位置に基づくスコア (0〜1)",
},
{
name: "queryAnalysis",
type: "object",
description: "クエリ解析の詳細",
isOptional: true,
properties: [
{
type: "number",
parameters: [
{
name: "magnitude",
description: "クエリの強度",
},
],
},
{
type: "number[]",
parameters: [
{
name: "dominantFeatures",
description: "クエリの主要な特徴",
},
],
},
],
},
]}
/>

## 関連情報 \{#related\}

* [createVectorQueryTool](../tools/vector-query-tool)