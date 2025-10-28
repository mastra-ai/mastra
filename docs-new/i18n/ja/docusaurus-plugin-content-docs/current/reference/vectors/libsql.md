---
title: "デフォルトのベクトルストア"
description: Mastra の LibSQLVector クラスのドキュメント。LibSQL のベクトル拡張機能を用いたベクトル検索を提供します。
---

# LibSQLVector ストア \{#libsqlvector-store\}

LibSQL のストレージ実装は、ベクター拡張を備えた SQLite 互換のベクター検索である [LibSQL](https://github.com/tursodatabase/libsql)（SQLite のフォーク）および同じくベクター拡張を備えた [Turso](https://turso.tech/) を対象に、軽量かつ効率的なベクターデータベースソリューションを提供します。
これは `@mastra/libsql` パッケージの一部で、メタデータフィルタリングに対応した高効率なベクター類似検索を提供します。

## インストール \{#installation\}

```bash copy
npm install @mastra/libsql@latest
```

## 使い方 \{#usage\}

```typescript copy showLineNumbers
import { LibSQLVector } from "@mastra/libsql";

// 新しいベクターストアのインスタンスを作成
const store = new LibSQLVector({
  connectionUrl: process.env.DATABASE_URL,
  // 任意: Turso のクラウドデータベース向け
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

// インデックスを作成
await store.createIndex({
  indexName: "myCollection",
  dimension: 1536,
});

// メタデータ付きでベクトルを追加
const vectors = [[0.1, 0.2, ...], [0.3, 0.4, ...]];
const metadata = [
  { text: "1 件目のドキュメント", category: "A" },
  { text: "2 件目のドキュメント", category: "B" }
];
await store.upsert({
  indexName: "myCollection",
  vectors,
  metadata,
});

// 類似ベクトルをクエリする
const queryVector = [0.1, 0.2, ...];
const results = await store.query({
  indexName: "myCollection",
  queryVector,
  topK: 10, // 上位 K 件の結果
  filter: { category: "A" } // メタデータの任意フィルター
});
```

## コンストラクターのオプション \{#constructor-options\}

<PropertiesTable
  content={[
{
name: "connectionUrl",
type: "string",
description:
"LibSQL データベースの URL。インメモリーデータベースには ':memory:'、ローカルファイルには 'file:dbname.db'、または 'libsql://your-database.turso.io' のような LibSQL 互換の接続文字列を使用します。",
},
{
name: "authToken",
type: "string",
isOptional: true,
description: "Turso クラウドデータベース用の認証トークン",
},
{
name: "syncUrl",
type: "string",
isOptional: true,
description: "データベースのレプリケーション用 URL（Turso 固有）",
},
{
name: "syncInterval",
type: "number",
isOptional: true,
description:
"データベース同期の間隔（ミリ秒、Turso 固有）",
},
]}
/>

## メソッド \{#methods\}

### createIndex() \{#createindex\}

新しいベクターコレクションを作成します。インデックス名は英字またはアンダースコアで始まり、英字・数字・アンダースコアのみを含める必要があります。dimension は正の整数である必要があります。

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
description: "ベクターの次元数（使用する埋め込みモデルと一致している必要があります）",
},
{
name: "metric",
type: "'cosine' | 'euclidean' | 'dotproduct'",
isOptional: true,
defaultValue: "cosine",
description:
"類似検索に使用する距離指標。注: 現在、LibSQL でサポートされているのは cosine 類似度のみです。",
},
]}
/>

### upsert() \{#upsert\}

インデックス内のベクターとそのメタデータを追加または更新します。トランザクションにより、すべてのベクターがアトミックに挿入されることを保証します。いずれかの挿入が失敗した場合、操作全体がロールバックされます。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "挿入先のインデックス名",
},
{
name: "vectors",
type: "number[][]",
description: "埋め込みベクターの配列",
},
{
name: "metadata",
type: "Record<string, any>[]",
isOptional: true,
description: "各ベクターのメタデータ",
},
{
name: "ids",
type: "string[]",
isOptional: true,
description: "ベクターID（未指定の場合は自動生成）",
},
]}
/>

### query() \{#query\}

必要に応じてメタデータでフィルタリングし、類似ベクトルを検索します。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "検索対象のインデックス名",
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
description: "返す結果数",
},
{
name: "filter",
type: "Filter",
isOptional: true,
description: "メタデータフィルタ",
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
description: "類似度スコアの下限しきい値",
},
]}
/>

### describeIndex() \{#describeindex\}

インデックスの情報を取得します。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "詳細を取得するインデックスの名前",
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

インデックスとそのデータをすべて削除します。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "削除対象のインデックス名",
},
]}
/>

### listIndexes() \{#listindexes\}

データベース内のすべてのベクターインデックスを一覧します。

Returns: `Promise<string[]>`

### truncateIndex() \{#truncateindex\}

インデックス構造は維持したまま、インデックス内のすべてのベクターを削除します。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "削除対象のインデックス名",
},
]}
/>

### updateVector() \{#updatevector\}

指定したIDのベクターエントリを、新しいベクトルデータやメタデータで更新します。

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
description: "更新対象のベクターエントリID",
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
description: "更新する新しいベクトルデータ",
},
{
name: "update.metadata",
type: "Record<string, any>",
isOptional: true,
description: "更新する新しいメタデータ",
},
]}
/>

### deleteVector() \{#deletevector\}

ID で指定したベクトルエントリをインデックスから削除します。

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
description: "削除するベクトルエントリの ID",
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
  vector?: number[]; // includeVector が true の場合にのみ含まれる
}
```

## エラー処理 \{#error-handling\}

このストアは、各種の失敗時に特定のエラーをスローします。

```typescript copy
try {
  await store.query({
    indexName: 'my-collection',
    queryVector: queryVector,
  });
} catch (error) {
  // 個別のエラーケースを処理する
  if (error.message.includes('Invalid index name format')) {
    console.error('インデックス名は英字またはアンダースコアで始まり、英数字のみを含める必要があります');
  } else if (error.message.includes('Table not found')) {
    console.error('指定されたインデックスは存在しません');
  } else {
    console.error('ベクトルストアのエラー:', error.message);
  }
}
```

一般的なエラー例には次のようなものがあります:

* インデックス名の形式が不正
* ベクトルの次元が不正
* テーブル／インデックスが見つからない
* データベース接続の問題
* upsert 中のトランザクション失敗

## 関連項目 \{#related\}

* [メタデータ フィルター](../rag/metadata-filters)