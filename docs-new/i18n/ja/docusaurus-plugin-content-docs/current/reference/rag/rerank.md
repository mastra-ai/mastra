---
title: "リファレンス: Rerank"
description: Mastra の rerank 関数に関するドキュメント。ベクター検索結果に対して高度な再ランキング機能を提供します。
---

# rerank() \{#rerank\}

`rerank()` 関数は、意味的関連性、ベクトル類似度、位置ベースのスコアリングを組み合わせることで、ベクター検索結果の高度なリランキング機能を提供します。

```typescript
function rerank(
  results: QueryResult[],
  query: string,
  modelConfig: ModelConfig,
  options?: RerankerFunctionOptions,
): Promise<RerankResult[]>;
```

## 使用例 \{#usage-example\}

```typescript
import { openai } from '@ai-sdk/openai';
import { rerank } from '@mastra/rag';

const model = openai('gpt-4o-mini');

const rerankedResults = await rerank(vectorSearchResults, '本番環境へのデプロイ方法は?', model, {
  weights: {
    semantic: 0.5,
    vector: 0.3,
    position: 0.2,
  },
  topK: 3,
});
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "results",
type: "QueryResult[]",
description: "再ランキング対象のベクター検索結果",
isOptional: false,
},
{
name: "query",
type: "string",
description: "関連性評価に使用する検索クエリのテキスト",
isOptional: false,
},
{
name: "model",
type: "MastraLanguageModel",
description: "再ランキングに使用する言語モデル",
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

rerank 関数は Vercel AI SDK の任意の LanguageModel を受け付けます。Cohere のモデル `rerank-v3.5` を使用する場合は、Cohere の再ランキング機能が自動的に利用されます。

> 注意: 再ランキング時にセマンティック・スコアリングが正しく機能するためには、各結果の `metadata.text` フィールドにテキストコンテンツが含まれている必要があります。

### RerankerFunctionOptions \{#rerankerfunctionoptions\}

<PropertiesTable
  content={[
{
name: "weights",
type: "WeightConfig",
description:
"各スコアリング要素の重み（合計が 1 である必要があります）",
isOptional: true,
properties: [
{
type: "number",
parameters: [
{
name: "semantic",
description: "セマンティック関連度の重み",
isOptional: true,
type: "number (default: 0.4)",
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
type: "number (default: 0.4)",
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
type: "number (default: 0.2)",
},
],
},
],
},
{
name: "queryEmbedding",
type: "number[]",
description: "クエリの埋め込みベクトル",
isOptional: true,
},
{
name: "topK",
type: "number",
description: "返却する上位結果の件数",
isOptional: true,
defaultValue: "3",
},
]}
/>

## 戻り値 \{#returns\}

この関数は `RerankResult` オブジェクトの配列を返します:

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
description: "再ランク付け後の総合スコア（0〜1）",
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
description: "意味的関連度スコア (0〜1)",
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
description: "クエリ分析の詳細",
isOptional: true,
properties: [
{
type: "number",
parameters: [
{
name: "magnitude",
description: "クエリのマグニチュード",
},
],
},
{
type: "number[]",
parameters: [
{
name: "dominantFeatures",
description: "クエリの主要特徴",
},
],
},
],
},
]}
/>

## 関連項目 \{#related\}

* [createVectorQueryTool](../tools/vector-query-tool)