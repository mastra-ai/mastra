---
title: "createGraphRAGTool() "
description: Mastra の Graph RAG ツールに関するドキュメント。ドキュメント間の意味的関係をグラフ化することで、RAG を強化します。
---

# createGraphRAGTool() \{#creategraphragtool\}

`createGraphRAGTool()` は、ドキュメント間の意味関係のグラフを構築して RAG を強化するツールを作成します。内部的には `GraphRAG` システムを用いてグラフベースの検索を提供し、直接的な類似性と関連関係の両方から関連コンテンツを見つけます。

## 使い方の例 \{#usage-example\}

```typescript
import { openai } from '@ai-sdk/openai';
import { createGraphRAGTool } from '@mastra/rag';

const graphTool = createGraphRAGTool({
  vectorStoreName: 'pinecone',
  indexName: 'docs',
  model: openai.embedding('text-embedding-3-small'),
  graphOptions: {
    dimension: 1536,
    threshold: 0.7,
    randomWalkSteps: 100,
    restartProb: 0.15,
  },
});
```

## パラメータ \{#parameters\}

:::note

**パラメータ要件:** ほとんどのフィールドは作成時にデフォルトとして設定できます。
一部のフィールドは、ランタイムコンテキストまたは入力によって実行時に上書きできます。必須フィールドが作成時・実行時の両方で欠落している場合はエラーがスローされます。なお、`model`、`id`、`description` は作成時にのみ設定可能です。

:::

<PropertiesTable
  content={[
{
name: "id",
type: "string",
description:
"ツールのカスタム ID。デフォルト: 'GraphRAG {vectorStoreName} {indexName} Tool'。（作成時のみ設定）",
isOptional: true,
},
{
name: "description",
type: "string",
description:
"ツールのカスタム説明。デフォルト: 'ナレッジベース内の情報間の関係にアクセスして分析し、つながりやパターンに関する複雑な質問に回答します。'（作成時のみ設定）",
isOptional: true,
},
{
name: "vectorStoreName",
type: "string",
description:
"クエリ対象のベクターストア名。（作成時に設定、または実行時に上書き可能）",
isOptional: false,
},
{
name: "indexName",
type: "string",
description:
"ベクターストア内のインデックス名。（作成時に設定、または実行時に上書き可能）",
isOptional: false,
},
{
name: "model",
type: "EmbeddingModel",
description:
"ベクトル検索に使用する埋め込みモデル。（作成時のみ設定）",
isOptional: false,
},
{
name: "enableFilter",
type: "boolean",
description:
"メタデータに基づく結果のフィルタリングを有効化します。（作成時のみ設定。ただし、実行時コンテキストでフィルタが指定された場合は自動的に有効化されます）",
isOptional: true,
defaultValue: "false",
},
{
name: "includeSources",
type: "boolean",
description:
"結果に完全な取得オブジェクトを含めます。（作成時に設定、または実行時に上書き可能）",
isOptional: true,
defaultValue: "true",
},
{
name: "graphOptions",
type: "GraphOptions",
description: "グラフベースの取得の設定",
isOptional: true,
defaultValue: "デフォルトのグラフオプション",
},
{
name: "providerOptions",
type: "Record<string, Record<string, any>>",
description:
"埋め込みモデル向けのプロバイダー固有オプション（例: outputDimensionality）。**重要**: AI SDK の EmbeddingModelV2 モデルでのみ有効です。V1 モデルではモデル作成時にオプションを設定してください。",
isOptional: true,
},
]}
/>

### GraphOptions \{#graphoptions\}

<PropertiesTable
  content={[
{
name: "dimension",
type: "number",
description: "埋め込みベクトルの次元数",
isOptional: true,
defaultValue: "1536",
},
{
name: "threshold",
type: "number",
description:
"ノード間にエッジを作成するための類似度のしきい値（0～1）",
isOptional: true,
defaultValue: "0.7",
},
{
name: "randomWalkSteps",
type: "number",
description:
"グラフ探索におけるランダムウォークのステップ数（作成時に設定、または実行時に上書き可能）。",
isOptional: true,
defaultValue: "100",
},
{
name: "restartProb",
type: "number",
description:
"クエリノードからランダムウォークを再開する確率（作成時に設定、または実行時に上書き可能）。",
isOptional: true,
defaultValue: "0.15",
},
]}
/>

## 返り値 \{#returns\}

このツールは次のプロパティを持つオブジェクトを返します：

<PropertiesTable
  content={[
{
name: "relevantContext",
type: "string",
description:
"グラフベースのランキングで抽出した、最も関連性の高いドキュメントチャンクから結合したテキスト",
},
{
name: "sources",
type: "QueryResult[]",
description:
"完全なリトリーバル結果オブジェクトの配列。各オブジェクトには、元のドキュメント、チャンク、類似度スコアを参照するために必要な情報がすべて含まれます。",
},
]}
/>

### QueryResult オブジェクトの構造 \{#queryresult-object-structure\}

```typescript
{
  id: string;         // 一意のチャンク／ドキュメント識別子
  metadata: any;      // すべてのメタデータフィールド（ドキュメントID など）
  vector: number[];   // 埋め込みベクトル（利用可能な場合）
  score: number;      // この取得における類似度スコア
  document: string;   // チャンク／ドキュメントの全文（利用可能な場合）
}
```

## デフォルトのツール説明 \{#default-tool-description\}

デフォルトの説明は次の点に焦点を当てています:

* ドキュメント間の関係を分析する
* パターンやつながりを見つける
* 複雑な問い合わせに回答する

## 応用例 \{#advanced-example\}

```typescript
const graphTool = createGraphRAGTool({
  vectorStoreName: 'pinecone',
  indexName: 'docs',
  model: openai.embedding('text-embedding-3-small'),
  graphOptions: {
    dimension: 1536,
    threshold: 0.8, // 類似度の閾値を高く設定
    randomWalkSteps: 200, // 探索ステップ数を増やす
    restartProb: 0.2, // 再開確率を高く設定
  },
});
```

## カスタム説明の例 \{#example-with-custom-description\}

```typescript
const graphTool = createGraphRAGTool({
  vectorStoreName: 'pinecone',
  indexName: 'docs',
  model: openai.embedding('text-embedding-3-small'),
  description:
    "当社の履歴データに含まれる複雑なパターンやつながりを見つけるために、文書間の関係を分析します",
});
```

この例では、リレーションシップ分析というツールの本来の目的を保ちながら、特定のユースケースに合わせてツールの説明をカスタマイズする方法を示します。

## 例：ランタイムコンテキストの使用 \{#example-using-runtime-context\}

```typescript
const graphTool = createGraphRAGTool({
  vectorStoreName: 'pinecone',
  indexName: 'docs',
  model: openai.embedding('text-embedding-3-small'),
});
```

ランタイムコンテキストを使用する場合、必要なパラメータは実行時にランタイムコンテキスト経由で渡してください。

```typescript
const runtimeContext = new RuntimeContext<{
  vectorStoreName: string;
  indexName: string;
  topK: number;
  filter: any;
}>();
runtimeContext.set('vectorStoreName', 'my-store');
runtimeContext.set('indexName', 'my-index');
runtimeContext.set('topK', 5);
runtimeContext.set('filter', { category: 'docs' });
runtimeContext.set('randomWalkSteps', 100);
runtimeContext.set('restartProb', 0.15);

const response = await agent.generate('ナレッジベースからドキュメントを検索してください。', {
  runtimeContext,
});
```

ランタイムコンテキストの詳細は、次をご参照ください。

* [Agent Runtime Context](/docs/server-db/runtime-context)
* [Tool Runtime Context](/docs/tools-mcp/runtime-context)

## 関連項目 \{#related\}

* [createVectorQueryTool](./vector-query-tool)
* [GraphRAG](../rag/graph-rag)