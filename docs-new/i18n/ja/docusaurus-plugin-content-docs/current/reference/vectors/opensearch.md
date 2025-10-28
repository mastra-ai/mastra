---
title: "リファレンス: OpenSearch ベクターストア"
description: Mastra の OpenSearchVector クラスに関するドキュメント。OpenSearch を用いたベクター検索を提供します。
---

# OpenSearch ベクターストア \{#opensearch-vector-store\}

OpenSearchVector クラスは、強力なオープンソースの検索・分析エンジンである [OpenSearch](https://opensearch.org/) を使用してベクター検索を提供します。OpenSearch の k-NN 機能を活用し、高速かつ効率的なベクター類似検索を実行します。

## コンストラクタのオプション \{#constructor-options\}

<PropertiesTable
  content={[
{
name: "url",
type: "string",
description: "OpenSearch の接続URL（例: 'http://localhost:9200'）",
},
]}
/>

## 方法 \{#methods\}

### createIndex() \{#createindex\}

指定した設定で新しいインデックスを作成します。

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
description: "インデックスに格納するベクトルの次元数",
},
{
name: "metric",
type: "'cosine' | 'euclidean' | 'dotproduct'",
description: "ベクトル類似度に用いる距離指標",
defaultValue: "'cosine'",
isOptional: true,
},
]}
/>

### listIndexes() \{#listindexes\}

OpenSearch インスタンス内のすべてのインデックスを一覧します。

Returns: `Promise<string[]>`

### describeIndex() \{#describeindex\}

インデックスの情報を取得します。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "詳細を取得するインデックス名",
},
]}
/>

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

### upsert() \{#upsert\}

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "ベクターをアップサートするインデックス名",
},
{
name: "vectors",
type: "number[][]",
description: "挿入するベクター埋め込みの配列",
},
{
name: "metadata",
type: "Record<string, any>[]",
description: "各ベクターに対応するメタデータオブジェクトの配列",
isOptional: true,
},
{
name: "ids",
type: "string[]",
description:
"ベクターのIDの任意配列。指定しない場合はランダムなIDが生成されます",
isOptional: true,
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
description: "類似ベクトルを検索するためのクエリ用ベクトル",
},
{
name: "topK",
type: "number",
description: "返す結果の件数",
defaultValue: "10",
isOptional: true,
},
{
name: "filter",
type: "VectorFilter",
description:
"クエリに適用するオプションのフィルター（MongoDB 形式のクエリ構文）",
isOptional: true,
},
]}
/>

### updateVector() \{#updatevector\}

ID で指定したベクトルエントリを、新しいベクトルデータやメタデータで更新します。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "ベクトルを更新するインデックスの名前",
},
{
name: "id",
type: "string",
description: "更新対象のベクトルの ID",
},
{
name: "update",
type: "object",
description: "ベクトルおよび/またはメタデータを含む更新用データ",
},
{
name: "update.vector",
type: "number[]",
description: "新しいベクトル埋め込み",
isOptional: true,
},
{
name: "update.metadata",
type: "Record<string, any>",
description: "新しいメタデータ",
isOptional: true,
},
]}
/>

### deleteVector() \{#deletevector\}

インデックスから、指定したIDのベクターエントリを削除します。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "削除対象のベクターを含むインデックスの名前",
},
{
name: "ids",
type: "string[]",
description: "削除するベクターIDの配列",
},
]}
/>

## 関連 \{#related\}

* [メタデータ フィルター](../rag/metadata-filters)