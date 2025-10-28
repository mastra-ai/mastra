---
title: "リファレンス: Astra Vector Store"
description: Mastra の AstraVector クラスに関するドキュメント。DataStax Astra DB を用いたベクトル検索を提供します。
---

# Astra Vector Store \{#astra-vector-store\}

AstraVector クラスは、Apache Cassandra 上に構築されたクラウドネイティブかつサーバーレスなデータベースである [DataStax Astra DB](https://www.datastax.com/products/datastax-astra) を用いてベクター検索を実現します。
エンタープライズ級のスケーラビリティと高可用性を備えたベクター検索機能を提供します。

## コンストラクターのオプション \{#constructor-options\}

<PropertiesTable
  content={[
{
name: "token",
type: "string",
description: "Astra DB の API トークン",
},
{
name: "endpoint",
type: "string",
description: "Astra DB の API エンドポイント",
},
{
name: "keyspace",
type: "string",
isOptional: true,
description: "オプションの keyspace 名",
},
]}
/>

## 方法 \{#methods\}

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
description: "ベクトルの次元数（使用する埋め込みモデルと一致させる必要があります）",
},
{
name: "metric",
type: "'cosine' | 'euclidean' | 'dotproduct'",
isOptional: true,
defaultValue: "cosine",
description:
"類似検索用の距離指標（dotproduct の場合は dot_product にマッピングされます）",
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
name: "metadata",
type: "Record<string, any>[]",
isOptional: true,
description: "各ベクトルのメタデータ",
},
{
name: "ids",
type: "string[]",
isOptional: true,
description: "ベクトルID（省略時は自動生成）",
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
description: "類似ベクトルを検索するためのクエリベクトル",
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
description: "クエリに適用するメタデータフィルター",
},
{
name: "includeVector",
type: "boolean",
isOptional: true,
defaultValue: "false",
description: "結果にベクトルを含めるかどうか",
},
]}
/>

### listIndexes() \{#listindexes\}

インデックス名の文字列の配列を返します。

### describeIndex() \{#describeindex\}

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "詳細を表示する対象のインデックス名",
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
description: "ベクターを含むインデックスの名前",
},
{
name: "id",
type: "string",
description: "更新対象のベクターのID",
},
{
name: "update",
type: "object",
description: "ベクターおよび／またはメタデータの変更を含む更新オブジェクト",
properties: [
{
name: "vector",
type: "number[]",
isOptional: true,
description: "新しいベクターの値",
},
{
name: "metadata",
type: "Record<string, any>",
isOptional: true,
description: "新しいメタデータの値",
},
],
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

クエリ結果は次の形式で返されます。

```typescript copy
interface QueryResult {
  id: string;
  score: number;
  metadata: Record<string, any>;
  vector?: number[]; // includeVectorがtrueの場合のみ含まれる
}
```

## エラー処理 \{#error-handling\}

このストアは、キャッチ可能な型付きエラーをスローします。

```typescript copy
try {
  await store.query({
    indexName: 'index_name',
    queryVector: queryVector,
  });
} catch (error) {
  if (error instanceof VectorStoreError) {
    console.log(error.code); // 'connection_failed' | 'invalid_dimension' | など
    console.log(error.details); // エラーの詳細情報
  }
}
```

## 環境変数 \{#environment-variables\}

必須の環境変数:

* `ASTRA_DB_TOKEN`: Astra DB の API トークン
* `ASTRA_DB_ENDPOINT`: Astra DB の API エンドポイント

## 関連情報 \{#related\}

* [メタデータフィルター](../rag/metadata-filters)