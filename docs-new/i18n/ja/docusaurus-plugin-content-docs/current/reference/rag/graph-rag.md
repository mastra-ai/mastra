---
title: "リファレンス: GraphRAG"
description: Mastra の GraphRAG クラスのドキュメント。グラフベースの手法による Retrieval-Augmented Generation を実装しています。
---

# GraphRAG \{#graphrag\}

`GraphRAG` クラスは、RAG（Retrieval-Augmented Generation）に対するグラフベースの手法を実装します。ドキュメントのチャンクからナレッジグラフを構築し、ノードでドキュメントを、エッジで意味的な関係を表現することで、直接の類似度マッチングに加え、グラフ探索を通じた関連コンテンツの発見を可能にします。

## 基本の使い方 \{#basic-usage\}

```typescript
import { GraphRAG } from '@mastra/rag';

const graphRag = new GraphRAG({
  dimension: 1536,
  threshold: 0.7,
});

// チャンクと埋め込みからグラフを作成
graphRag.createGraph(documentChunks, embeddings);

// 埋め込みでグラフをクエリ
const results = await graphRag.query({
  query: queryEmbedding,
  topK: 10,
  randomWalkSteps: 100,
  restartProb: 0.15,
});
```

## コンストラクタのパラメーター \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "dimension",
type: "number",
description: "埋め込みベクトルの次元",
isOptional: true,
defaultValue: "1536",
},
{
name: "threshold",
type: "number",
description:
"ノード間にエッジを作成するための類似度のしきい値（0〜1）",
isOptional: true,
defaultValue: "0.7",
},
]}
/>

## 手法 \{#methods\}

### createGraph \{#creategraph\}

ドキュメントのチャンクとそれらの埋め込みに基づいて、ナレッジグラフを作成します。

```typescript
createGraph(chunks: GraphChunk[], embeddings: GraphEmbedding[]): void
```

#### パラメーター \{#parameters\}

<PropertiesTable
  content={[
{
name: "chunks",
type: "GraphChunk[]",
description: "テキストとメタデータを含むドキュメントのチャンク配列",
isOptional: false,
},
{
name: "embeddings",
type: "GraphEmbedding[]",
description: "各チャンクに対応する埋め込みの配列",
isOptional: false,
},
]}
/>

### query \{#query\}

ベクトル類似度とグラフの走査を組み合わせて、グラフベースの検索を行います。

```typescript
query({
  query,
  topK = 10,
  randomWalkSteps = 100,
  restartProb = 0.15
}: {
  query: number[];
  topK?: number;
  randomWalkSteps?: number;
  restartProb?: number;
}): RankedNode[]
```

#### パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "query",
type: "number[]",
description: "クエリの埋め込みベクトル",
isOptional: false,
},
{
name: "topK",
type: "number",
description: "返す結果の数",
isOptional: true,
defaultValue: "10",
},
{
name: "randomWalkSteps",
type: "number",
description: "ランダムウォークのステップ数",
isOptional: true,
defaultValue: "100",
},
{
name: "restartProb",
type: "number",
description: "クエリノードからウォークを再開する確率",
isOptional: true,
defaultValue: "0.15",
},
]}
/>

#### 返却値 \{#returns\}

各ノードが次を含む `RankedNode` オブジェクトの配列を返します:

<PropertiesTable
  content={[
{
name: "id",
type: "string",
description: "ノードの一意の識別子",
},
{
name: "content",
type: "string",
description: "ドキュメントチャンクのテキストコンテンツ",
},
{
name: "metadata",
type: "Record<string, any>",
description: "チャンクに関連付けられた追加メタデータ",
},
{
name: "score",
type: "number",
description: "グラフ探索に基づく総合関連度スコア",
},
]}
/>

## 発展的な例 \{#advanced-example\}

```typescript
const graphRag = new GraphRAG({
  dimension: 1536,
  threshold: 0.8, // より厳密な類似度の閾値
});

// チャンクと埋め込みからグラフを作成
graphRag.createGraph(documentChunks, embeddings);

// カスタムパラメータでクエリ
const results = await graphRag.query({
  query: queryEmbedding,
  topK: 5,
  randomWalkSteps: 200,
  restartProb: 0.2,
});
```

## 関連項目 \{#related\}

* [createGraphRAGTool](../tools/graph-rag-tool)