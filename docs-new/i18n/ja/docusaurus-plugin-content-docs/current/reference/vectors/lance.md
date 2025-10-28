---
title: "リファレンス：Lance Vector Store"
description: "Mastra の LanceVectorStore クラスのドキュメント。Lance 列指向フォーマットに基づく組み込み型ベクターデータベース LanceDB を用いたベクター検索を提供します。"
---

# Lance Vector Store \{#lance-vector-store\}

LanceVectorStore クラスは、Lance のカラムナフォーマット上に構築された組み込みベクトルデータベースである [LanceDB](https://lancedb.github.io/lancedb/) を利用してベクトル検索を提供します。ローカル開発環境から本番環境まで、効率的な保存と高速な類似検索を実現します。

## ファクトリーメソッド \{#factory-method\}

LanceVectorStore は生成にファクトリーパターンを採用しています。コンストラクタを直接使わず、静的な `create()` メソッドを使用してください。

<PropertiesTable
  content={[
{
name: "uri",
type: "string",
description: "LanceDB データベースへのパス、またはクラウド環境向けの URI",
},
{
name: "options",
type: "ConnectionOptions",
description:
"LanceDB の追加の接続オプション",
isOptional: true,
},
]}
/>

## コンストラクターの例 \{#constructor-examples\}

`LanceVectorStore` のインスタンスは、静的な create メソッドを使って作成できます。

```ts
import { LanceVectorStore } from '@mastra/lance';

// ローカルのデータベースに接続
const vectorStore = await LanceVectorStore.create('/path/to/db');

// LanceDB のクラウドデータベースに接続
const cloudStore = await LanceVectorStore.create('db://host:port');

// オプションを指定してクラウドデータベースに接続
const s3Store = await LanceVectorStore.create('s3://bucket/db', {
  storageOptions: { timeout: '60s' },
});
```

## 方法 \{#methods\}

### createIndex() \{#createindex\}

<PropertiesTable
  content={[
{
name: "tableName",
type: "string",
description: "インデックスを作成するテーブル名",
},
{
name: "indexName",
type: "string",
description: "作成するインデックス（列名）",
},
{
name: "dimension",
type: "number",
description: "ベクトル次元（使用する埋め込みモデルと一致している必要があります）",
},
{
name: "metric",
type: "'cosine' | 'euclidean' | 'dotproduct'",
isOptional: true,
defaultValue: "cosine",
description: "類似検索に用いる距離指標",
},
{
name: "indexConfig",
type: "LanceIndexConfig",
isOptional: true,
defaultValue: "{ type: 'hnsw' }",
description: "インデックス設定",
},
]}
/>

#### LanceIndexConfig \{#lanceindexconfig\}

<PropertiesTable
  content={[
{
name: "type",
type: "'ivfflat' | 'hnsw'",
description: "インデックス種別",
defaultValue: "hnsw",
properties: [
{
type: "string",
parameters: [
{
name: "ivfflat",
type: "ivfflat",
description:
"近似検索のためにベクトルを複数のリスト（クラスタ）に分割します。",
},
{
name: "hnsw",
type: "hnsw",
description:
"高速な検索と高い再現率を実現するグラフベースのインデックス。",
},
],
},
],
},
{
name: "numPartitions",
type: "number",
isOptional: true,
defaultValue: "128",
description: "IVF インデックスのパーティション数",
},
{
name: "numSubVectors",
type: "number",
isOptional: true,
defaultValue: "16",
description: "プロダクト量子化におけるサブベクトル数",
},
{
name: "hnsw",
type: "HNSWConfig",
isOptional: true,
description: "HNSW の設定",
properties: [
{
type: "object",
parameters: [
{
name: "m",
type: "number",
description:
"ノードあたりの最大接続数（デフォルト: 16）",
isOptional: true,
},
{
name: "efConstruction",
type: "number",
description: "構築時の探索幅（デフォルト: 100）",
isOptional: true,
},
],
},
],
},
]}
/>

### createTable() \{#createtable\}

<PropertiesTable
  content={[
{
name: "tableName",
type: "string",
description: "作成するテーブル名",
},
{
name: "data",
type: "Record<string, unknown>[] | TableLike",
description: "テーブルの初期データ",
},
{
name: "options",
type: "Partial<CreateTableOptions>",
isOptional: true,
description: "テーブル作成時の追加オプション",
},
]}
/>

### upsert() \{#upsert\}

<PropertiesTable
  content={[
{
name: "tableName",
type: "string",
description: "ベクトルをアップサートする対象テーブル名",
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
name: "tableName",
type: "string",
description: "クエリするテーブル名",
},
{
name: "queryVector",
type: "number[]",
description: "クエリベクトル",
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
description: "メタデータのフィルタ",
},
{
name: "includeVector",
type: "boolean",
isOptional: true,
defaultValue: "false",
description: "結果にベクトルを含めるか",
},
{
name: "columns",
type: "string[]",
isOptional: true,
defaultValue: "[]",
description: "結果に含める列の指定",
},
{
name: "includeAllColumns",
type: "boolean",
isOptional: true,
defaultValue: "false",
description: "結果にすべての列を含めるか",
},
]}
/>

### listTables() \{#listtables\}

テーブル名（文字列）の配列を返します。

```typescript copy
const tables = await vectorStore.listTables();
// ['my_vectors', 'embeddings', 'documents']
```

### getTableSchema() \{#gettableschema\}

<PropertiesTable
  content={[
{
name: "tableName",
type: "string",
description: "スキーマを取得するテーブル名",
},
]}
/>

指定したテーブルのスキーマを返します。

### deleteTable() \{#deletetable\}

<PropertiesTable
  content={[
{
name: "tableName",
type: "string",
description: "削除するテーブルの名前",
},
]}
/>

### deleteAllTables() \{#deletealltables\}

データベース内の全テーブルを削除します。

### listIndexes() \{#listindexes\}

インデックス名の文字列配列を返します。

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

インデックスの情報を返します。

```typescript copy
interface IndexStats {
  dimension: number;
  count: number;
  metric: 'cosine' | 'euclidean' | 'dotproduct';
  type: 'ivfflat' | 'hnsw';
  config: {
    m?: number;
    efConstruction?: number;
    numPartitions?: number;
    numSubVectors?: number;
  };
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
description: "更新対象のベクターID",
},
{
name: "update",
type: "object",
description: "更新パラメーター",
properties: [
{
type: "object",
parameters: [
{
name: "vector",
type: "number[]",
description: "新しいベクターの値",
isOptional: true,
},
{
name: "metadata",
type: "Record<string, any>",
description: "新しいメタデータの値",
isOptional: true,
},
],
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
description: "ベクターを含むインデックス名",
},
{
name: "id",
type: "string",
description: "削除対象のベクターID",
},
]}
/>

### close() \{#close\}

データベース接続を閉じる。

## レスポンスの種類 \{#response-types\}

クエリ結果は次の形式で返されます。

```typescript copy
interface QueryResult {
  id: string;
  score: number;
  metadata: Record<string, any>;
  vector?: number[]; // includeVector が true の場合にのみ含まれる
  document?: string; // 利用可能な場合のドキュメントの本文
}
```

## エラー処理 \{#error-handling\}

このストアは型付きエラーをスローし、捕捉できます：

```typescript copy
try {
  await store.query({
    tableName: 'my_vectors',
    queryVector: queryVector,
  });
} catch (error) {
  if (error instanceof Error) {
    console.log(error.message);
  }
}
```

## ベストプラクティス \{#best-practices\}

* ユースケースに適したインデックス種別を使用する：
  * メモリに余裕がある場合は、再現率とパフォーマンス向上のために HNSW を使用
  * 大規模データセットでのメモリ効率のために IVF を使用
* 大規模データセットで最適な性能を得るには、`numPartitions` と `numSubVectors` の値の調整を検討する
* データベースの利用が終わったら、`close()` メソッドで接続を適切に閉じる
* フィルタリングを簡素化するため、メタデータは一貫したスキーマで保存する

## 関連項目 \{#related\}

* [メタデータ フィルター](../rag/metadata-filters)