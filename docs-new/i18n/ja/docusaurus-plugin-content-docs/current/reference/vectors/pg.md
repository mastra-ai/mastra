---
title: "リファレンス: PG Vector Store"
description: Mastra の PgVector クラスに関するドキュメント。pgvector 拡張機能を利用した PostgreSQL によるベクトル検索を提供します。
---

# PG Vector Store \{#pg-vector-store\}

PgVector クラスは、[PostgreSQL](https://www.postgresql.org/) の [pgvector](https://github.com/pgvector/pgvector) 拡張機能を利用したベクトル検索を提供します。
既存の PostgreSQL データベース上で、堅牢なベクトル類似度検索機能を実現します。

## コンストラクタのオプション \{#constructor-options\}

<PropertiesTable
  content={[
{
name: "connectionString",
type: "string",
description: "PostgreSQL の接続 URL",
},
{
name: "schemaName",
type: "string",
description:
"ベクターストアで使用するスキーマ名。指定がない場合は既定のスキーマが使用されます。",
isOptional: true,
},
]}
/>

## コンストラクターの例 \{#constructor-examples\}

`PgVector` は設定オブジェクト（任意で schemaName を指定可）を使ってインスタンス化できます：

```ts
import { PgVector } from '@mastra/pg';

const vectorStore = new PgVector({
  connectionString: 'postgresql://user:password@localhost:5432/mydb',
  schemaName: 'custom_schema', // 省略可能
});
```

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
description: "ベクトルの次元数（使用する埋め込みモデルに合わせる必要があります）",
},
{
name: "metric",
type: "'cosine' | 'euclidean' | 'dotproduct'",
isOptional: true,
defaultValue: "cosine",
description: "類似検索で使用する距離指標",
},
{
name: "indexConfig",
type: "IndexConfig",
isOptional: true,
defaultValue: "{ type: 'ivfflat' }",
description: "インデックスの設定",
},
{
name: "buildIndex",
type: "boolean",
isOptional: true,
defaultValue: "true",
description: "インデックスを構築するかどうか",
},
]}
/>

#### IndexConfig \{#indexconfig\}

<PropertiesTable
  content={[
{
name: "type",
type: "'flat' | 'hnsw' | 'ivfflat'",
description: "インデックスの種類",
defaultValue: "ivfflat",
properties: [
{
type: "string",
parameters: [
{
name: "flat",
type: "flat",
description:
"全件走査（インデックスなし）による厳密検索。",
},
{
name: "ivfflat",
type: "ivfflat",
description:
"近似検索のためにベクトルを複数のリストにクラスタリングします。",
},
{
name: "hnsw",
type: "hnsw",
description:
"高速かつ高再現率のグラフベース・インデックス。",
},
],
},
],
},
{
name: "ivf",
type: "IVFConfig",
isOptional: true,
description: "IVF の設定",
properties: [
{
type: "object",
parameters: [
{
name: "lists",
type: "number",
description:
"リスト数。未指定の場合はデータセット規模に基づいて自動計算されます（最小 100、最大 4000）。",
isOptional: true,
},
],
},
],
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
"ノードあたりの最大接続数（デフォルト: 8）",
isOptional: true,
},
{
name: "efConstruction",
type: "number",
description: "構築時の探索幅（デフォルト: 32）",
isOptional: true,
},
],
},
],
},
]}
/>

#### メモリ要件 \{#memory-requirements\}

HNSW インデックスは構築時に多くの共有メモリを必要とします。100K ベクトルの場合:

* 小さい次元数 (64 次元): デフォルト設定で約 60MB
* 中程度の次元数 (256 次元): デフォルト設定で約 180MB
* 大きい次元数 (384 次元以上): デフォルト設定で約 250MB 以上

M や efConstruction の値を高く設定すると、必要なメモリが大幅に増加します。必要に応じて、システムの共有メモリ上限を調整してください。

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
description: "任意のベクトルID（未指定の場合は自動生成）",
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
name: "vector",
type: "number[]",
description: "クエリ用ベクトル",
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
description: "メタデータフィルタ",
},
{
name: "includeVector",
type: "boolean",
isOptional: true,
defaultValue: "false",
description: "結果にベクトルを含めるかどうか",
},
{
name: "minScore",
type: "number",
isOptional: true,
defaultValue: "0",
description: "類似度スコアの最小閾値",
},
{
name: "options",
type: "{ ef?: number; probes?: number }",
isOptional: true,
description: "HNSW および IVF インデックス向けの追加オプション",
properties: [
{
type: "object",
parameters: [
{
name: "ef",
type: "number",
description: "HNSW の検索パラメータ",
isOptional: true,
},
{
name: "probes",
type: "number",
description: "IVF の検索パラメータ",
isOptional: true,
},
],
},
],
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
description: "記述するインデックスの名前",
},
]}
/>

返り値:

```typescript copy
interface PGIndexStats {
  dimension: number;
  count: number;
  metric: 'cosine' | 'euclidean' | 'dotproduct';
  type: 'flat' | 'hnsw' | 'ivfflat';
  config: {
    m?: number;
    efConstruction?: number;
    lists?: number;
    probes?: number;
  };
}
```

### deleteIndex() \{#deleteindex\}

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
description: "更新するベクターのID",
},
{
name: "update",
type: "object",
description: "更新パラメータ",
properties: [
{
type: "object",
parameters: [
{
name: "vector",
type: "number[]",
description: "新しいベクター値",
isOptional: true,
},
{
name: "metadata",
type: "Record<string, any>",
description: "新しいメタデータ値",
isOptional: true,
},
],
},
],
},
]}
/>

ID を指定して既存のベクターを更新します。vector または metadata の少なくとも一方を指定する必要があります。

```typescript copy
// ベクトルのみを更新
await pgVector.updateVector({
  indexName: 'my_vectors',
  id: 'vector123',
  update: {
    vector: [0.1, 0.2, 0.3],
  },
});

// メタデータのみを更新
await pgVector.updateVector({
  indexName: 'my_vectors',
  id: 'vector123',
  update: {
    metadata: { label: 'updated' },
  },
});

// ベクトルとメタデータを両方更新
await pgVector.updateVector({
  indexName: 'my_vectors',
  id: 'vector123',
  update: {
    vector: [0.1, 0.2, 0.3],
    metadata: { label: 'updated' },
  },
});
```

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

指定したインデックスから、IDで指定した単一のベクトルを削除します。

```typescript copy
await pgVector.deleteVector({ indexName: 'my_vectors', id: 'vector123' });
```

### disconnect() \{#disconnect\}

データベースの接続プールを閉じます。ストアの使用を終えたら呼び出してください。

### buildIndex() \{#buildindex\}

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "定義するインデックス名",
},
{
name: "metric",
type: "'cosine' | 'euclidean' | 'dotproduct'",
isOptional: true,
defaultValue: "cosine",
description: "類似検索に用いる距離メトリック",
},
{
name: "indexConfig",
type: "IndexConfig",
description: "インデックス種別およびパラメータの設定",
},
]}
/>

指定したメトリックと設定でインデックスを作成または再作成します。新しいインデックスを作成する前に、既存のインデックスは削除されます。

```typescript copy
// HNSW インデックスを定義する
await pgVector.buildIndex('my_vectors', 'cosine', {
  type: 'hnsw',
  hnsw: {
    m: 8,
    efConstruction: 32,
  },
});

// IVF インデックスを定義する
await pgVector.buildIndex('my_vectors', 'cosine', {
  type: 'ivfflat',
  ivf: {
    lists: 100,
  },
});

// フラットインデックスを定義する
await pgVector.buildIndex('my_vectors', 'cosine', {
  type: 'flat',
});
```

## レスポンスの種類 \{#response-types\}

クエリ結果は次の形式で返されます。

```typescript copy
interface QueryResult {
  id: string;
  score: number;
  metadata: Record<string, any>;
  vector?: number[]; // includeVector が true の場合にのみ含まれる
}
```

## エラー処理 \{#error-handling\}

ストアは、キャッチ可能な型付きエラーをスローします。

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

## インデックス設定ガイド \{#index-configuration-guide\}

### パフォーマンスの最適化 \{#performance-optimization\}

#### IVFFlat のチューニング \{#ivfflat-tuning\}

* **lists パラメータ**: ベクトル数 n に対して `sqrt(n) * 2` を目安に設定
* リスト数が多いほど、精度は向上するがビルド時間は長くなる
* リスト数が少ないほど、ビルドは速いが精度が低下する可能性がある

#### HNSW のチューニング \{#hnsw-tuning\}

* **m パラメータ**:
  * 8-16: 精度は中程度、メモリ使用量は少なめ
  * 16-32: 高精度、メモリ使用量は中程度
  * 32-64: 非常に高精度、メモリ使用量は多め
* **efConstruction**:
  * 32-64: 構築が速く、品質は良好
  * 64-128: 構築はやや遅く、品質はより良い
  * 128-256: 構築が最も遅く、品質は最高

### インデックス再作成の挙動 \{#index-recreation-behavior\}

システムは設定の変更を自動検出し、必要な場合にのみインデックスを再構築します：

* 設定が同一: インデックスを保持（再作成なし）
* 設定が変更: インデックスを削除して再構築
* これにより、不要なインデックス再作成によるパフォーマンス低下を防ぎます

## ベストプラクティス \{#best-practices\}

* 最適なパフォーマンスを維持するために、インデックス設定を定期的に見直してください。
* データセットの規模やクエリ要件に応じて、`lists` や `m` といったパラメータを調整してください。
* `describeIndex()` を用いて使用状況を把握し、**インデックスのパフォーマンスを監視**してください。
* 特に大幅なデータ更新後は、効率を保つためにインデックスを定期的に再構築してください。

## プールへの直接アクセス \{#direct-pool-access\}

`PgVector` クラスは、内部の PostgreSQL 接続プールをパブリックフィールドとして公開しています:

```typescript
pgVector.pool; // pg.Pool のインスタンス
```

これにより、直接SQLクエリの実行、トランザクションの管理、プール状態の監視といった高度な利用が可能になります。プールを直接使用する場合:

* 使用後はクライアントを解放する責任があります（`client.release()`）。
* `disconnect()` を呼び出した後もプールにはアクセスできますが、新規クエリは失敗します。
* 直接アクセスすると、PgVector のメソッドが提供する検証やトランザクションロジックは適用されません。

この設計は高度なユースケースをサポートしますが、ユーザーによる慎重なリソース管理が求められます。

## 関連項目 \{#related\}

* [メタデータフィルター](../rag/metadata-filters)