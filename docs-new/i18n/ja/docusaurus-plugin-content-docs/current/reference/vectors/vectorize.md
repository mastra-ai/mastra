---
title: "リファレンス: Cloudflare Vector Store"
description: Mastra の CloudflareVector クラスのドキュメント。Cloudflare Vectorize を用いたベクター検索を提供します。
---

# Cloudflare ベクターストア \{#cloudflare-vector-store\}

CloudflareVector クラスは、Cloudflare のエッジネットワークに統合されたベクターデータベースサービスである [Cloudflare Vectorize](https://developers.cloudflare.com/vectorize/) を利用して、ベクター検索機能を提供します。

## コンストラクターのオプション \{#constructor-options\}

<PropertiesTable
  content={[
{
name: "accountId",
type: "string",
description: "Cloudflare アカウント ID",
},
{
name: "apiToken",
type: "string",
description: "Vectorize の権限を持つ Cloudflare API トークン",
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
description: "ベクトルの次元数（使用する埋め込みモデルと一致している必要があります）",
},
{
name: "metric",
type: "'cosine' | 'euclidean' | 'dotproduct'",
isOptional: true,
defaultValue: "cosine",
description:
"類似検索に用いる距離指標（dotproduct はドット積に対応）",
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
description: "ベクトルID（指定しない場合は自動生成）",
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
description: "類似ベクトルの検索に用いるクエリベクトル",
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
description: "詳細を表示する対象のインデックス名",
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
description: "削除するインデックス名",
},
]}
/>

### createMetadataIndex() \{#createmetadataindex\}

メタデータフィールドにインデックスを作成し、フィルタリングを可能にします。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "メタデータフィールドを含むインデックス名",
},
{
name: "propertyName",
type: "string",
description: "インデックス化するメタデータフィールド名",
},
{
name: "indexType",
type: "'string' | 'number' | 'boolean'",
description: "メタデータフィールドの型",
},
]}
/>

### deleteMetadataIndex() \{#deletemetadataindex\}

メタデータフィールドのインデックスを削除します。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "メタデータフィールドを含むインデックス名",
},
{
name: "propertyName",
type: "string",
description: "インデックス付けを解除するメタデータフィールド名",
},
]}
/>

### listMetadataIndexes() \{#listmetadataindexes\}

インデックスに対するすべてのメタデータフィールドのインデックスを一覧表示します。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "メタデータインデックスを一覧表示する対象のインデックス名",
},
]}
/>

### updateVector() \{#updatevector\}

インデックス内の特定のIDに対して、ベクトルまたはメタデータを更新します。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "更新対象のIDを含むインデックス名",
},
{
name: "id",
type: "string",
description: "更新対象のベクトルまたはメタデータの一意の識別子",
},
{
name: "update",
type: "{ vector?: number[]; metadata?: Record<string, any>; }",
description: "更新するベクトルやメタデータを含むオブジェクト",
},
]}
/>

### deleteVector() \{#deletevector\}

インデックス内の特定の ID に対して、ベクターとその関連メタデータを削除します。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "削除対象の ID を含むインデックス名",
},
{
name: "id",
type: "string",
description: "削除するベクターおよびメタデータの一意の識別子",
},
]}
/>

## レスポンスの種類 \{#response-types\}

クエリの結果は次の形式で返されます。

```typescript copy
interface QueryResult {
  id: string;
  score: number;
  metadata: Record<string, any>;
  vector?: number[];
}
```

## エラー処理 \{#error-handling\}

このストアは型付きエラーをスローし、それを捕捉できます。

```typescript copy
try {
  await store.query({
    indexName: 'index_name',
    queryVector: queryVector,
  });
} catch (error) {
  if (error instanceof VectorStoreError) {
    console.log(error.code); // 'connection_failed' | 'invalid_dimension' | など
    console.log(error.details); // 追加のエラー詳細
  }
}
```

## 環境変数 \{#environment-variables\}

必須の環境変数:

* `CLOUDFLARE_ACCOUNT_ID`: Cloudflare のアカウント ID
* `CLOUDFLARE_API_TOKEN`: Vectorize の権限を持つ Cloudflare の API トークン

## 関連項目 \{#related\}

* [メタデータフィルター](../rag/metadata-filters)