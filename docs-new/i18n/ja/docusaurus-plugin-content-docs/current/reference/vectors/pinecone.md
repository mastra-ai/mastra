---
title: "リファレンス: Pinecone ベクトルストア"
description: Mastra の PineconeVector クラスのドキュメント。Pinecone のベクトルデータベースへのインターフェースを提供します。
---

# Pinecone ベクターストア \{#pinecone-vector-store\}

PineconeVector クラスは、[Pinecone](https://www.pinecone.io/) のベクターデータベース用インターフェースを提供します。
ハイブリッド検索、メタデータによるフィルタリング、名前空間の管理などに対応し、リアルタイムなベクトル検索を実現します。

## コンストラクターオプション \{#constructor-options\}

<PropertiesTable
  content={[
{
name: "apiKey",
type: "string",
description: "Pinecone の API キー",
},
{
name: "environment",
type: "string",
description: "Pinecone の環境（例：「us-west1-gcp」）",
},
]}
/>

## メソッド \{#methods\}

### createIndex() \{#createindex\}

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
description:
"類似検索の距離指標。ハイブリッド検索を使用する場合は「dotproduct」を使用してください。",
},
]}
/>

### upsert() \{#upsert\}

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "Pinecone インデックス名",
},
{
name: "vectors",
type: "number[][]",
description: "密ベクトル（埋め込み）の配列",
},
{
name: "sparseVectors",
type: "{ indices: number[], values: number[] }[]",
isOptional: true,
description:
"ハイブリッド検索用の疎ベクトル配列。各ベクトルでは indices と values の配列が対応している必要があります。",
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
description: "ベクトル ID（未指定の場合は自動生成）",
},
{
name: "namespace",
type: "string",
isOptional: true,
description:
"ベクトルを保存する任意の名前空間。異なる名前空間間のベクトルは互いに分離されます。",
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
name: "vector",
type: "number[]",
description: "類似ベクトルの検索に用いる密ベクトル",
},
{
name: "sparseVector",
type: "{ indices: number[], values: number[] }",
isOptional: true,
description:
"ハイブリッド検索用のオプションのスパースベクトル。indices と values の配列は対応している必要があります。",
},
{
name: "topK",
type: "number",
isOptional: true,
defaultValue: "10",
description: "返す結果の件数",
},
{
name: "filter",
type: "Record<string, any>",
isOptional: true,
description: "クエリ用のメタデータフィルタ",
},
{
name: "includeVector",
type: "boolean",
isOptional: true,
defaultValue: "false",
description: "結果にベクトルを含めるかどうか",
},
{
name: "namespace",
type: "string",
isOptional: true,
description:
"クエリ対象のオプションの namespace。指定した namespace の結果のみを返します。",
},
]}
/>

### listIndexes() \{#listindexes\}

インデックス名の文字列配列を返します。

### describeIndex() \{#describeindex\}

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "説明対象のインデックス名",
},
]}
/>

戻り値：

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
description: "削除するインデックス名",
},
]}
/>

### updateVector() \{#updatevector\}

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "ベクトルを含むインデックス名",
},
{
name: "id",
type: "string",
description: "更新対象のベクトルID",
},
{
name: "update",
type: "object",
description: "更新パラメーター",
},
{
name: "update.vector",
type: "number[]",
isOptional: true,
description: "更新後のベクトル値",
},
{
name: "update.metadata",
type: "Record<string, any>",
isOptional: true,
description: "更新後のメタデータ",
},
]}
/>

### deleteVector() \{#deletevector\}

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "ベクトルを含むインデックス名",
},
{
name: "id",
type: "string",
description: "削除するベクトルのID",
},
]}
/>

## レスポンスの種類 \{#response-types\}

クエリ結果は次の形式で返されます：

```typescript copy
interface QueryResult {
  id: string;
  score: number;
  metadata: Record<string, any>;
  vector?: number[]; // includeVector が true の場合のみ含まれます
}
```

## エラーハンドリング \{#error-handling\}

ストアは、キャッチ可能な型付きエラーをスローします:

```typescript copy
try {
  await store.query({
    indexName: 'index_name',
    queryVector: queryVector,
  });
} catch (error) {
  if (error instanceof VectorStoreError) {
    console.log(error.code); // 'connection_failed' | 'invalid_dimension' | etc
    console.log(error.details); // 追加のエラーに関する詳細情報
  }
}
```

### 環境変数 \{#environment-variables\}

必須の環境変数:

* `PINECONE_API_KEY`: Pinecone の API キー
* `PINECONE_ENVIRONMENT`: Pinecone の環境（例：&#39;us-west1-gcp&#39;）

## ハイブリッド検索 \{#hybrid-search\}

Pinecone は、密ベクトルと疎ベクトルを組み合わせてハイブリッド検索をサポートします。ハイブリッド検索を使用するには：

1. `metric: 'dotproduct'` を指定してインデックスを作成します
2. アップサート時に `sparseVectors` パラメータで疎ベクトルを指定します
3. クエリ時に `sparseVector` パラメータで疎ベクトルを指定します

## 関連項目 \{#related\}

* [メタデータフィルター](../rag/metadata-filters)