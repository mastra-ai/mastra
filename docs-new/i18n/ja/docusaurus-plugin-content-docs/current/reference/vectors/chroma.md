---
title: "Chroma ベクターストア"
description: Mastra の ChromaVector クラスに関するドキュメント。ChromaDB を用いたベクター検索を提供します。
---

# Chroma ベクトルストア \{#chroma-vector-store\}

ChromaVector クラスは、オープンソースの埋め込みデータベース [Chroma](https://docs.trychroma.com/docs/overview/getting-started) を用いたベクトル検索を提供します。
メタデータによるフィルタリングやハイブリッド検索に対応した、高効率なベクトル検索を実現します。

:::note Chroma Cloud

Chroma Cloud はサーバーレスのベクトル検索と全文検索を提供します。非常に高速で、コスト効率が高く、スケーラブル、かつ手軽に利用できます。データベースを作成し、$5 分の無料クレジットで 30 秒以内に試せます。

[Chroma Cloud を始める](https://trychroma.com/signup)

:::

## コンストラクターオプション \{#constructor-options\}

<PropertiesTable
  content={[
{
name: "host",
type: "string",
isOptional: true,
description: "Chroma サーバーのホストアドレス。既定値は 'localhost' です",
},
{
name: "port",
type: "number",
isOptional: true,
description: "Chroma サーバーのポート番号。既定値は 8000 です",
},
{
name: "ssl",
type: "boolean",
isOptional: true,
description: "接続に SSL/HTTPS を使用するかどうか。既定値は false です",
},
{
name: "apiKey",
type: "string",
isOptional: true,
description: "Chroma Cloud の API キー",
},
{
name: "tenant",
type: "string",
isOptional: true,
description: "接続先の Chroma サーバーのテナント名。シングルノード版 Chroma の既定値は 'default_tenant'。Chroma Cloud の場合は、提供された API キーに基づき自動的に解決されます",
},
{
name: "database",
type: "string",
isOptional: true,
description: "接続先のデータベース名。シングルノード版 Chroma の既定値は 'default_database'。Chroma Cloud の場合は、提供された API キーに基づき自動的に解決されます",
},
{
name: "headers",
type: "Record<string, any>",
isOptional: true,
description: "リクエストに付与する追加の HTTP ヘッダー",
},
{
name: "fetchOptions",
type: "RequestInit",
isOptional: true,
description: "HTTP リクエストに用いる追加の fetch オプション",
}
]}
/>

## Chroma サーバーの実行 \{#running-a-chroma-server\}

Chroma Cloud のユーザーは、`ChromaVector` のコンストラクタに API キー、テナント、データベース名を渡すだけで利用できます。

`@mastra/chroma` パッケージをインストールすると、[Chroma CLI](https://docs.trychroma.com/docs/cli/db) を利用でき、次のコマンドでこれらを環境変数として設定できます: `chroma db connect [DB-NAME] --env-file`。

それ以外の場合は、シングルノードの Chroma サーバーをセットアップする方法がいくつかあります:

* Chroma CLI を使ってローカルで実行する: `chroma run`。その他の設定オプションは [Chroma docs](https://docs.trychroma.com/docs/cli/run) を参照してください。
* 公式の Chroma イメージを使用して [Docker](https://docs.trychroma.com/guides/deploy/docker) 上で実行する。
* お好みのプロバイダーに独自の Chroma サーバーをデプロイする。Chroma は [AWS](https://docs.trychroma.com/guides/deploy/aws)、[Azure](https://docs.trychroma.com/guides/deploy/azure)、[GCP](https://docs.trychroma.com/guides/deploy/gcp) 向けのサンプルテンプレートを提供しています。

## 手法 \{#methods\}

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
description: "ベクトルの次元数（使用する埋め込みモデルに一致させる必要があります）",
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

### forkIndex() \{#forkindex\}

注: フォークは Chroma Cloud、または自前でデプロイした OSS の**分散**版 Chroma でのみサポートされています。

`forkIndex` を使うと、既存の Chroma インデックスを即座にフォークできます。フォークしたインデックスに対する操作は、元のインデックスには影響しません。詳しくは [Chroma ドキュメント](https://docs.trychroma.com/cloud/collection-forking) をご覧ください。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "フォークするインデックス名",
},
{
name: "newIndexName",
type: "string",
description: "フォーク後のインデックス名",
}
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
description: "オプションのベクトルID（未指定の場合は自動生成）",
},
{
name: "documents",
type: "string[]",
isOptional: true,
description:
"Chroma 固有: ベクトルに対応する元のテキストドキュメント",
},
]}
/>

### query() \{#query\}

`queryVector` を使ってインデックスを検索します。`queryVector` からの距離が近い順に、意味的に類似したレコードの配列を返します。各レコードの構造は次のとおりです:

```typescript
{
  id: string;
  score: number;
  document?: string;
  metadata?: Record<string, string | number | boolean>;
  embedding?: number[]
}
```

型推論のために、`query` 呼び出しにメタデータの型（シェイプ）を指定することもできます: `query<T>()`。

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
description: "類似ベクトル検索用のクエリベクトル",
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
name: "documentFilter",
type: "Record<string, any>",
isOptional: true,
description: "Chroma 固有: ドキュメント内容に適用するフィルター",
},
]}
/>

### get() \{#get\}

ID、メタデータ、ドキュメントフィルターを使って Chroma インデックスからレコードを取得します。以下の形式のレコード配列を返します:

```typescript
{
  id: string;
  document?: string;
  metadata?: Record<string, string | number | boolean>;
  embedding?: number[]
}
```

型推論のために、メタデータの型を `get` 呼び出しに指定することもできます: `get<T>()`。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "クエリ対象のインデックス名",
},
{
name: "ids",
type: "string[]",
isOptional: true,
description: "返却するレコードIDのリスト。指定しない場合は全レコードが返されます。",
},
{
name: "filter",
type: "Record<string, any>",
isOptional: true,
description: "メタデータのフィルター。",
},
{
name: "includeVector",
type: "boolean",
isOptional: true,
defaultValue: "false",
description: "結果にベクターを含めるかどうか",
},
{
name: "documentFilter",
type: "Record<string, any>",
isOptional: true,
description: "Chroma 固有: ドキュメント内容に適用するフィルター",
},
{
name: "limit",
type: "number",
isOptional: true,
defaultValue: 100,
description: "返却するレコードの最大数",
},
{
name: "offset",
type: "number",
isOptional: true,
defaultValue: 0,
description: "レコード取得時のオフセット。`limit` と併用して結果をページネーションします。",
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
description: "詳細を表示するインデックス名",
},
]}
/>

返り値:

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
description: "更新するベクターを含むインデックス名",
},
{
name: "id",
type: "string",
description: "更新するベクターのID",
},
{
name: "update",
type: "object",
description: "更新パラメータ",
},
]}
/>

`update` オブジェクトには、次の項目を含めることができます:

<PropertiesTable
  content={[
{
name: "vector",
type: "number[]",
isOptional: true,
description: "既存のベクターを置き換える新しいベクター",
},
{
name: "metadata",
type: "Record<string, any>",
isOptional: true,
description: "既存のメタデータを置き換える新しいメタデータ",
},
]}
/>

### deleteVector() \{#deletevector\}

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "削除対象のベクターを含むインデックス名",
},
{
name: "id",
type: "string",
description: "削除対象のベクターID",
},
]}
/>

## レスポンスタイプ \{#response-types\}

クエリ結果は次の形式で返されます。

```typescript copy
interface QueryResult {
  id: string;
  score: number;
  metadata: Record<string, any>;
  document?: string; // Chroma 固有: 保存されている場合は元のドキュメント
  vector?: number[]; // includeVector が true の場合にのみ含まれる
}
```

## エラー処理 \{#error-handling\}

ストアは、キャッチ可能な型付きエラーをスローします：

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