---
title: "リファレンス: Qdrant ベクターストア"
description: Mastra と Qdrant の統合に関するドキュメント。Qdrant は、ベクターとペイロードを管理するためのベクトル類似検索エンジンです。
---

# Qdrant ベクトルストア \{#qdrant-vector-store\}

QdrantVector クラスは、ベクトル類似検索エンジンである [Qdrant](https://qdrant.tech/) を用いたベクトル検索を提供します。
追加のペイロードや拡張フィルタリングに対応し、ベクトルの保存・検索・管理を行うための使いやすい API を備えた本番運用向けサービスを提供します。

## コンストラクターのオプション \{#constructor-options\}

<PropertiesTable
  content={[
{
name: "url",
type: "string",
description:
"Qdrant インスタンスの REST URL。例: https://xyz-example.eu-central.aws.cloud.qdrant.io:6333",
},
{
name: "apiKey",
type: "string",
description: "任意の Qdrant API キー",
},
{
name: "https",
type: "boolean",
description:
"接続時に TLS を使用するかどうか。推奨。",
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
description: "類似検索に用いる距離尺度",
},
]}
/>

### upsert() \{#upsert\}

<PropertiesTable
  content={[
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
name: "topK",
type: "number",
isOptional: true,
defaultValue: "10",
description: "返却する件数",
},
{
name: "filter",
type: "Record<string, any>",
isOptional: true,
description: "クエリのメタデータフィルター",
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
description: "削除する対象のインデックス名",
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
description: "更新対象のベクトルのID",
},
{
name: "update",
type: "{ vector?: number[]; metadata?: Record<string, any>; }",
description: "更新する vector および/または metadata を含むオブジェクト",
},
]}
/>

指定したインデックス内のベクトルおよび/またはそのメタデータを更新します。vector と metadata の両方が指定された場合は両方を更新し、いずれかのみが指定された場合はその片方のみを更新します。

### deleteVector() \{#deletevector\}

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "ベクターを削除する対象のインデックス名",
},
{
name: "id",
type: "string",
description: "削除対象のベクターID",
},
]}
/>

指定したインデックスから、IDを指定してベクターを削除します。

## レスポンスタイプ \{#response-types\}

クエリ結果は次の形式で返されます：

```typescript copy
interface QueryResult {
  id: string;
  score: number;
  metadata: Record<string, any>;
  vector?: number[]; // includeVector が true の場合にのみ含まれる
}
```

## エラーハンドリング \{#error-handling\}

ストアは型付きエラーをスローし、捕捉できます:

```typescript copy
try {
  await store.query({
    indexName: 'index_name',
    queryVector: queryVector,
  });
} catch (error) {
  if (error instanceof VectorStoreError) {
    console.log(error.code); // 'connection_failed' | 'invalid_dimension' | など
    console.log(error.details); // 追加のエラー情報
  }
}
```

## 関連項目 \{#related\}

* [メタデータフィルター](../rag/metadata-filters)