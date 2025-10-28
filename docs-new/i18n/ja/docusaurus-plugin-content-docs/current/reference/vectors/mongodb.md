---
title: "リファレンス: MongoDB ベクターストア"
description: Mastra の MongoDBVector クラスのドキュメント。MongoDB Atlas と Atlas Vector Search を使用したベクター検索を提供します。
---

# MongoDB ベクターストア \{#mongodb-vector-store\}

`MongoDBVector` クラスは、[MongoDB Atlas Vector Search](https://www.mongodb.com/docs/atlas/atlas-vector-search/) を利用したベクトル検索を提供します。これにより、MongoDB のコレクション内で効率的な類似検索とメタデータによるフィルタリングが可能になります。

## インストール \{#installation\}

```bash copy
npm install @mastra/mongodb
```

## 使い方の例 \{#usage-example\}

```typescript copy showLineNumbers
import { MongoDBVector } from '@mastra/mongodb';

const store = new MongoDBVector({
  url: process.env.MONGODB_URL,
  database: process.env.MONGODB_DATABASE,
});
```

## コンストラクターのオプション \{#constructor-options\}

<PropertiesTable
  content={[
{
name: "url",
type: "string",
description: "MongoDB 接続文字列（URI）",
},
{
name: "database",
type: "string",
description: "使用する MongoDB のデータベース名",
},
{
name: "options",
type: "MongoClientOptions",
isOptional: true,
description: "任意の MongoDB クライアントオプション",
},
]}
/>

## メソッド \{#methods\}

### createIndex() \{#createindex\}

MongoDB に新しいベクトルインデックス（コレクション）を作成します。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "作成するコレクション名",
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
description: "類似検索に用いる距離指標",
},
]}
/>

### upsert() \{#upsert\}

コレクション内のベクトルとそのメタデータを追加または更新します。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "挿入先のコレクション名",
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
description: "ベクトルID（未指定の場合は自動生成）",
},
]}
/>

### query() \{#query\}

メタデータのフィルタリング（任意）を使って類似ベクトルを検索します。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "検索対象のコレクション名",
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
description: "返却する結果数",
},
{
name: "filter",
type: "Record<string, any>",
isOptional: true,
description: "メタデータのフィルター（`metadata` フィールドに適用）",
},
{
name: "documentFilter",
type: "Record<string, any>",
isOptional: true,
description: "元のドキュメントフィールドに対するフィルター（メタデータ以外も含む）",
},
{
name: "includeVector",
type: "boolean",
isOptional: true,
defaultValue: "false",
description: "結果にベクトルデータを含めるかどうか",
},
{
name: "minScore",
type: "number",
isOptional: true,
defaultValue: "0",
description: "最小類似度スコアの閾値",
},
]}
/>

### describeIndex() \{#describeindex\}

インデックス（コレクション）に関する情報を返します。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "説明対象のコレクション名",
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

コレクションとそのデータをすべて削除します。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "削除するコレクション名",
},
]}
/>

### listIndexes() \{#listindexes\}

MongoDB データベース内のすべてのベクターコレクションを一覧します。

Returns: `Promise<string[]>`

### updateVector() \{#updatevector\}

ID を指定して、対象のベクトリエントリを新しいベクトルデータやメタデータで更新します。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "ベクトルを含むコレクション名",
},
{
name: "id",
type: "string",
description: "更新対象のベクトリエントリの ID",
},
{
name: "update",
type: "object",
description: "ベクトルおよび/またはメタデータを含む更新内容",
},
{
name: "update.vector",
type: "number[]",
isOptional: true,
description: "更新後のベクトルデータ",
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

ID を指定して、インデックスから特定のベクターエントリを削除します。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "ベクターを含むコレクション名",
},
{
name: "id",
type: "string",
description: "削除するベクターエントリのID",
},
]}
/>

### disconnect() \{#disconnect\}

MongoDB クライアントの接続を閉じます。ストアの利用が終わったら呼び出してください。

## レスポンスタイプ \{#response-types\}

クエリ結果は次の形式で返されます：

```typescript copy
interface QueryResult {
  id: string;
  score: number;
  metadata: Record<string, any>;
  vector?: number[]; // includeVectorがtrueの場合のみ含まれる
}
```

## エラー処理 \{#error-handling\}

ストアは型付きのエラーをスローし、捕捉できます：

```typescript copy
try {
  await store.query({
    indexName: 'my_collection',
    queryVector: queryVector,
  });
} catch (error) {
  // 特定のエラーケースを処理
  if (error.message.includes('Invalid collection name')) {
    console.error('コレクション名は文字またはアンダースコアで始まり、有効な文字のみを含む必要があります。');
  } else if (error.message.includes('Collection not found')) {
    console.error('指定されたコレクションが存在しません');
  } else {
    console.error('ベクトルストアエラー:', error.message);
  }
}
```

## ベストプラクティス \{#best-practices\}

* クエリのパフォーマンスを最適化するため、フィルターで使用するメタデータフィールドにインデックスを付与する。
* 予期しないクエリ結果を避けるため、メタデータのフィールド名を統一する。
* 検索を効率的に保つため、インデックスとコレクションの統計を定期的に監視する。

## 関連項目 \{#related\}

* [メタデータ フィルター](../rag/metadata-filters)