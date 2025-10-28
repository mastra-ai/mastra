---
title: "リファレンス: Turbopuffer ベクターストア"
description: Mastra と統合するためのドキュメント。効率的な類似検索を実現する高性能ベクターデータベースです。
---

# Turbopuffer ベクターストア \{#turbopuffer-vector-store\}

TurbopufferVector クラスは、RAG アプリケーション向けに最適化された高性能ベクターデータベース [Turbopuffer](https://turbopuffer.com/) を用いて、ベクトル検索を提供します。Turbopuffer は、高度なフィルタ機能と効率的なストレージ管理により、高速なベクトル類似検索を実現します。

## コンストラクターのオプション \{#constructor-options\}

<PropertiesTable
  content={[
{
name: "apiKey",
type: "string",
description: "Turbopuffer で認証するための API キー。",
},
{
name: "baseUrl",
type: "string",
isOptional: true,
defaultValue: "https://api.turbopuffer.com",
description: "Turbopuffer API のベース URL。",
},
{
name: "connectTimeout",
type: "number",
isOptional: true,
defaultValue: "10000",
description:
"接続確立までのタイムアウト（ms）。Node および Deno のみ有効。",
},
{
name: "connectionIdleTimeout",
type: "number",
isOptional: true,
defaultValue: "60000",
description:
"ソケットのアイドルタイムアウト（ms）。Node および Deno のみ有効。",
},
{
name: "warmConnections",
type: "number",
isOptional: true,
defaultValue: "0",
description:
"新規クライアント作成時に事前に確立しておく接続数。",
},
{
name: "compression",
type: "boolean",
isOptional: true,
defaultValue: "true",
description:
"リクエストを圧縮し、圧縮レスポンスを受け入れるかどうか。",
},
{
name: "schemaConfigForIndex",
type: "function",
isOptional: true,
description:
"インデックス名を受け取り、そのインデックスの設定オブジェクトを返すコールバック関数。これにより、インデックスごとに明示的なスキーマを定義できます。",
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
description: "作成するインデックスの名前",
},
{
name: "dimension",
type: "number",
description: "ベクトルの次元（使用する埋め込みモデルと一致させる必要があります）",
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
description: "類似ベクトルを検索するためのクエリ用ベクトル",
},
{
name: "topK",
type: "number",
isOptional: true,
defaultValue: "10",
description: "返す結果の数",
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

インデックス名の文字列を要素とする配列を返します。

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
description: "削除するインデックス名",
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

## スキーマ構成 \{#schema-configuration\}

`schemaConfigForIndex` オプションを使うと、各インデックスに対して明示的なスキーマを定義できます。

```typescript copy
schemaConfigForIndex: (indexName: string) => {
  // Mastra のメモリメッセージ向けデフォルトの埋め込みモデルとインデックス:
  if (indexName === 'memory_messages_384') {
    return {
      dimensions: 384,
      schema: {
        thread_id: {
          type: 'string',
          filterable: true,
        },
      },
    };
  } else {
    throw new Error(`TODO: インデックスのスキーマを追加してください: ${indexName}`);
  }
};
```

## エラー処理 \{#error-handling\}

ストアは型付きのエラーをスローし、捕捉できます。

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

## 関連項目 \{#related\}

* [メタデータフィルタ](../rag/metadata-filters)