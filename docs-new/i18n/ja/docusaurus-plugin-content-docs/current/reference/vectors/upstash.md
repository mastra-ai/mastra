---
title: "リファレンス: Upstash Vector Store"
description: Mastra の UpstashVector クラスのドキュメント。Upstash Vector を用いたベクトル検索を提供します。
---

# Upstash Vector ストア \{#upstash-vector-store\}

UpstashVector クラスは、メタデータによるフィルタリング機能とハイブリッド検索に対応したサーバーレスのベクターデータベースサービス [Upstash Vector](https://upstash.com/vector) を利用して、ベクター検索を提供します。

## コンストラクターのオプション \{#constructor-options\}

<PropertiesTable
  content={[
{
name: "url",
type: "string",
description: "Upstash Vector データベースのURL",
},
{
name: "token",
type: "string",
description: "Upstash Vector APIトークン",
},
]}
/>

## 方法 \{#methods\}

### createIndex() \{#createindex\}

Note: Upstash ではこのメソッドは実行されません。インデックスは自動で作成されます。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "作成するインデックス名",
},
{
name: "dimension",
type: "number",
description: "ベクトルの次元数（使用する埋め込みモデルと一致している必要があります）",
},
{
name: "metric",
type: "'cosine' | 'euclidean' | 'dotproduct'",
isOptional: true,
defaultValue: "cosine",
description: "類似検索で使用する距離指標",
},
]}
/>

### upsert() \{#upsert\}

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "アップサート先のインデックス名",
},
{
name: "vectors",
type: "number[][]",
description: "埋め込みベクトルの配列",
},
{
name: "sparseVectors",
type: "{ indices: number[], values: number[] }[]",
isOptional: true,
description: "ハイブリッド検索用のスパースベクトル配列。各スパースベクトルでは indices と values の配列が対応している必要があります。",
},
{
name: "metadata",
type: "Record<string, any>[]",
isOptional: true,
description: "各ベクトルのメタデータ",
},
{
name: "ids",
type: "string[]",
isOptional: true,
description: "ベクトルID（未指定の場合は自動生成）",
},
]}
/>

### query() \{#query\}

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "クエリ対象のインデックス名",
},
{
name: "queryVector",
type: "number[]",
description: "類似ベクトル検索に用いるクエリベクトル",
},
{
name: "sparseVector",
type: "{ indices: number[], values: number[] }",
isOptional: true,
description: "ハイブリッド検索用の任意指定のスパースベクトル。indices と values の配列は対応している必要があります。",
},
{
name: "topK",
type: "number",
isOptional: true,
defaultValue: "10",
description: "返却する結果数",
},
{
name: "filter",
type: "Record<string, any>",
isOptional: true,
description: "クエリに適用するメタデータフィルター",
},
{
name: "includeVector",
type: "boolean",
isOptional: true,
defaultValue: "false",
description: "結果にベクトルを含めるかどうか",
},
{
name: "fusionAlgorithm",
type: "FusionAlgorithm",
isOptional: true,
description: "ハイブリッド検索で密・スパース両方の結果を統合する際に用いるアルゴリズム（例: RRF（Reciprocal Rank Fusion））",
},
{
name: "queryMode",
type: "QueryMode",
isOptional: true,
description: "検索モード: 'DENSE' は密のみ、'SPARSE' はスパースのみ、'HYBRID' は両者を組み合わせた検索",
},
]}
/>

### listIndexes() \{#listindexes\}

インデックス名（名前空間）を文字列の配列として返します。

### describeIndex() \{#describeindex\}

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "説明するインデックス名",
},
]}
/>

戻り値:

```typescript copy
interface IndexStats {
  dimension: number;
  count: number;
  metric: 'cosine' | 'euclidean' | 'dotproduct';
}
```

### deleteIndex() \{#deleteindex\}

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "削除するインデックス（名前空間）の名前",
},
]}
/>

### updateVector() \{#updatevector\}

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "更新対象のインデックス名",
},
{
name: "id",
type: "string",
description: "更新対象アイテムのID",
},
{
name: "update",
type: "object",
description: "vector、sparse vector、および/または metadata を含む更新用オブジェクト",
},
]}
/>

`update` オブジェクトには次のプロパティを指定できます:

* `vector`（任意）: 新しい dense vector を表す数値配列。
* `sparseVector`（任意）: ハイブリッドインデックス用の `indices` と `values` 配列を持つ sparse vector オブジェクト。
* `metadata`（任意）: メタデータのキーと値のペアからなるレコード。

### deleteVector() \{#deletevector\}

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "削除対象のアイテムが存在するインデックス名",
},
{
name: "id",
type: "string",
description: "削除するアイテムのID",
},
]}
/>

指定したインデックスから、IDを指定してアイテムの削除を試みます。削除に失敗した場合はエラーメッセージをログに出力します。

## ハイブリッドベクター検索 \{#hybrid-vector-search\}

Upstash Vector は、セマンティック検索（密ベクトル）とキーワード検索（疎ベクトル）を組み合わせて、関連性と精度を高めるハイブリッド検索をサポートします。

### ハイブリッドの基本的な使い方 \{#basic-hybrid-usage\}

```typescript copy
import { UpstashVector } from '@mastra/upstash';

const vectorStore = new UpstashVector({
  url: process.env.UPSTASH_VECTOR_URL,
  token: process.env.UPSTASH_VECTOR_TOKEN,
});

// 密ベクトルと疎ベクトルの両方をアップサートする
const denseVectors = [
  [0.1, 0.2, 0.3],
  [0.4, 0.5, 0.6],
];
const sparseVectors = [
  { indices: [1, 5, 10], values: [0.8, 0.6, 0.4] },
  { indices: [2, 6, 11], values: [0.7, 0.5, 0.3] },
];

await vectorStore.upsert({
  indexName: 'hybrid-index',
  vectors: denseVectors,
  sparseVectors: sparseVectors,
  metadata: [{ title: 'ドキュメント 1' }, { title: 'ドキュメント 2' }],
});

// ハイブリッド検索でクエリを実行する
const results = await vectorStore.query({
  indexName: 'hybrid-index',
  queryVector: [0.1, 0.2, 0.3],
  sparseVector: { indices: [1, 5], values: [0.9, 0.7] },
  topK: 10,
});
```

### 高度なハイブリッド検索のオプション \{#advanced-hybrid-search-options\}

```typescript copy
import { FusionAlgorithm, QueryMode } from '@upstash/vector';

// 指定した融合アルゴリズムでクエリを実行
const fusionResults = await vectorStore.query({
  indexName: 'hybrid-index',
  queryVector: [0.1, 0.2, 0.3],
  sparseVector: { indices: [1, 5], values: [0.9, 0.7] },
  fusionAlgorithm: FusionAlgorithm.RRF,
  topK: 10,
});

// 密ベクトルのみで検索
const denseResults = await vectorStore.query({
  indexName: 'hybrid-index',
  queryVector: [0.1, 0.2, 0.3],
  queryMode: QueryMode.DENSE,
  topK: 10,
});

// 疎ベクトルのみで検索
const sparseResults = await vectorStore.query({
  indexName: 'hybrid-index',
  queryVector: [0.1, 0.2, 0.3], // インデックス構造上、必須
  sparseVector: { indices: [1, 5], values: [0.9, 0.7] },
  queryMode: QueryMode.SPARSE,
  topK: 10,
});
```

### ハイブリッドベクトルの更新 \{#updating-hybrid-vectors\}

```typescript copy
// 密ベクトルと疎ベクトルの両方を更新
await vectorStore.updateVector({
  indexName: 'hybrid-index',
  id: 'vector-id',
  update: {
    vector: [0.2, 0.3, 0.4],
    sparseVector: { indices: [2, 7, 12], values: [0.9, 0.8, 0.6] },
    metadata: { title: '更新されたドキュメント' },
  },
});
```

## レスポンスの種類 \{#response-types\}

クエリ結果は次の形式で返されます：

```typescript copy
interface QueryResult {
  id: string;
  score: number;
  metadata: Record<string, any>;
  vector?: number[]; // includeVector が true のときにのみ含まれます
}
```

## エラー処理 \{#error-handling\}

ストアは、キャッチ可能な型付きエラーをスローします。

```typescript copy
try {
  await store.query({
    indexName: 'index_name',
    queryVector: queryVector,
  });
} catch (error) {
  if (error instanceof VectorStoreError) {
    console.log(error.code); // 'connection_failed' | 'invalid_dimension' | etc
    console.log(error.details); // 追加のエラーに関する情報
  }
}
```

## 環境変数 \{#environment-variables\}

必須の環境変数:

* `UPSTASH_VECTOR_URL`: Upstash Vector データベースの URL
* `UPSTASH_VECTOR_TOKEN`: Upstash Vector の API トークン

## 関連情報 \{#related\}

* [メタデータフィルタ](../rag/metadata-filters)