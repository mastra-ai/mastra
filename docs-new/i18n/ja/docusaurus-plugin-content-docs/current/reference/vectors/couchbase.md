---
title: "リファレンス: Couchbase Vector Store"
description: Mastra の CouchbaseVector クラスに関するドキュメント。Couchbase Vector Search を利用したベクター検索機能を提供します。
---

# Couchbase ベクターストア \{#couchbase-vector-store\}

`CouchbaseVector` クラスは、[Couchbase Vector Search](https://docs.couchbase.com/server/current/vector-search/vector-search.html) を利用してベクトル検索を実現します。これにより、Couchbase のコレクション内で効率的な類似度検索やメタデータによるフィルタリングが行えます。

## 前提条件 \{#requirements\}

* **Couchbase Server 7.6.4 以降**、または互換性のある Capella クラスター
* Couchbase のデプロイメントで **Search Service が有効** になっていること

## インストール \{#installation\}

```bash copy
npm install @mastra/couchbase
```

## 使い方の例 \{#usage-example\}

```typescript copy showLineNumbers
import { CouchbaseVector } from '@mastra/couchbase';

const store = new CouchbaseVector({
  connectionString: process.env.COUCHBASE_CONNECTION_STRING,
  username: process.env.COUCHBASE_USERNAME,
  password: process.env.COUCHBASE_PASSWORD,
  bucketName: process.env.COUCHBASE_BUCKET,
  scopeName: process.env.COUCHBASE_SCOPE,
  collectionName: process.env.COUCHBASE_COLLECTION,
});
```

## コンストラクターのオプション \{#constructor-options\}

<PropertiesTable
  content={[
{
name: "connectionString",
type: "string",
description: "Couchbase の接続文字列",
},
{
name: "username",
type: "string",
description: "Couchbase のユーザー名",
},
{
name: "password",
type: "string",
description: "Couchbase のパスワード",
},
{
name: "bucketName",
type: "string",
description: "使用する Couchbase バケット名",
},
{
name: "scopeName",
type: "string",
description: "使用する Couchbase スコープ名",
},
{
name: "collectionName",
type: "string",
description: "使用する Couchbase コレクション名",
},
{
name: "options",
type: "CouchbaseClientOptions",
isOptional: true,
description: "任意の Couchbase クライアントオプション",
},
]}
/>

## 方法 \{#methods\}

### createIndex() \{#createindex\}

Couchbase に新しいベクターインデックスを作成します。

> **注意:** インデックスの作成は非同期で行われます。`createIndex` を呼び出した後は、クエリを実行する前に時間を空けてください（小規模なデータセットでは通常 1〜5 秒、より大規模な場合はさらに長くかかります）。本番環境では固定の待機時間ではなく、ポーリングによってインデックスのステータスを確認する実装にしてください。

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
description: "ベクターの次元数（利用する埋め込みモデルと一致している必要があります）",
},
{
name: "metric",
type: "'cosine' | 'euclidean' | 'dotproduct'",
isOptional: true,
defaultValue: "cosine",
description: "類似検索で使用する距離メトリック",
},
]}
/>

### upsert() \{#upsert\}

コレクション内のベクトルとそのメタデータを追加または更新します。

> **注:** インデックスの作成前でも後でもデータをアップサートできます。`upsert` メソッドはインデックスの存在を前提としません。Couchbase では同一コレクションに対して複数の Search インデックスを作成できます。

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
description: "任意のベクトル ID（指定がない場合は自動生成）",
},
]}
/>

### query() \{#query\}

類似ベクトルを検索します。

> **警告:** 現在、`filter` と `includeVector` パラメータはサポートされていません。フィルタリングは結果取得後にクライアント側で行うか、Couchbase SDK の Search 機能を直接使用してください。ベクトル埋め込みを取得するには、Couchbase SDK を使用して ID でドキュメント全体を取得してください。

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
description: "類似ベクトルの検索に用いるクエリベクトル",
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
type: "Record<string, any>",
isOptional: true,
description: "メタデータによるフィルタ",
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

インデックスの情報を返します。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "詳細を取得するインデックス名",
},
]}
/>

戻り値:

```typescript copy
interface IndexStats {
  次元: number;
  件数: number;
  メトリック: 'cosine' | 'euclidean' | 'dotproduct';
}
```

### deleteIndex() \{#deleteindex\}

インデックスとそのすべてのデータを削除します。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "削除するインデックス名",
},
]}
/>

### listIndexes() \{#listindexes\}

Couchbase バケット内のすべてのベクター索引を一覧表示します。

戻り値: `Promise<string[]>`

### updateVector() \{#updatevector\}

指定したIDのベクターエントリを、新しいベクターデータやメタデータで更新します。

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
description: "更新対象のベクターエントリのID",
},
{
name: "update",
type: "object",
description: "ベクターやメタデータを含む更新データ",
},
{
name: "update.vector",
type: "number[]",
isOptional: true,
description: "更新後のベクターデータ",
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

ID を指定して、インデックスから特定のベクトル・エントリを削除します。

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
description: "削除するベクトル・エントリの ID",
},
]}
/>

### disconnect() \{#disconnect\}

Couchbase クライアントの接続を閉じます。ストアの利用が終わったら呼び出してください。

## レスポンスの種類 \{#response-types\}

クエリ結果は次の形式で返されます。

```typescript copy
interface QueryResult {
  id: string;
  score: number;
  metadata: Record<string, any>;
  vector?: number[]; // includeVector が true の場合のみ含まれます
}
```

## エラー処理 \{#error-handling\}

ストアは型付きエラーをスローし、捕捉できます:

```typescript copy
try {
  await store.query({
    indexName: 'my_index',
    queryVector: queryVector,
  });
} catch (error) {
  // 特定のエラーケースを処理
  if (error.message.includes('Invalid index name')) {
    console.error('インデックス名は英字またはアンダースコアで始まり、使用可能な文字のみで構成する必要があります。');
  } else if (error.message.includes('Index not found')) {
    console.error('指定されたインデックスは存在しません。');
  } else {
    console.error('ベクトルストアのエラー: ', error.message);
  }
}
```

## 注意事項 \{#notes\}

* **インデックス削除の注意点:** Search インデックスを削除しても、関連する Couchbase コレクション内のベクターやドキュメントは削除されません。データは明示的に削除しない限り残ります。
* **必要な権限:** 対象コレクションへの接続およびドキュメントの読み書き権限（`kv` ロール）と、Search Index の管理権限（該当する bucket/scope に対する `search_admin` ロール）が Couchbase ユーザーに必要です。
* **インデックス定義の詳細とドキュメント構造:** `createIndex` メソッドは、`embedding` フィールド（型: `vector`）と `content` フィールド（型: `text`）をインデックス化する Search Index 定義を作成し、指定された `scopeName.collectionName` 内のドキュメントを対象にします。各ドキュメントは `embedding` フィールドにベクターを、`metadata` フィールドにメタデータを格納します。`metadata` に `text` プロパティが含まれる場合、その値はトップレベルの `content` フィールドにもコピーされ、テキスト検索向けにインデックス化されます。
* **レプリケーションと耐久性:** データの耐久性のために、Couchbase の組み込みレプリケーションおよび永続化機能の利用を検討してください。効率的な検索を維持するため、インデックス統計を定期的に監視してください。

## 制限事項 \{#limitations\}

* インデックス作成の遅延により、作成直後のクエリ実行に影響が出る場合があります。
* 取り込み時にベクトル次元を厳密に検証・強制しません（次元不一致はクエリ時にエラーとなります）。
* ベクトルの挿入およびインデックスの更新は最終的整合性で動作し、書き込み直後の強い整合性は保証されません。

## 関連項目 \{#related\}

* [メタデータ フィルター](../rag/metadata-filters)