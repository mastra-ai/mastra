---
title: "リファレンス: Amazon S3 Vectors ストア"
description: Mastra の S3Vectors クラスのドキュメント。Amazon S3 Vectors（プレビュー）を用いたベクトル検索機能を提供します。
---

# Amazon S3 Vectors ストア \{#amazon-s3-vectors-store\}

> ⚠️ Amazon S3 Vectors はプレビューサービスです。
> プレビュー機能は予告なく変更または削除される場合があり、AWS の SLA の対象外です。
> 仕様、制限、リージョンでの提供状況は随時変更される可能性があります。
> このライブラリは、AWS との整合性を維持するために非互換の変更を導入する場合があります。

`S3Vectors` クラスは、[Amazon S3 Vectors（プレビュー）](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors.html) を使用したベクトル検索を提供します。ベクトルは **ベクトルバケット** に保存され、JSON ベースのメタデータフィルターを用いて **ベクトルインデックス** 上で類似検索が実行されます。

## インストール \{#installation\}

```bash copy
npm install @mastra/s3vectors
```

## 使用例 \{#usage-example\}

```typescript copy showLineNumbers
import { S3Vectors } from '@mastra/s3vectors';

const store = new S3Vectors({
  vectorBucketName: process.env.S3_VECTORS_BUCKET_NAME!, // 例: "my-vector-bucket"
  clientConfig: {
    region: process.env.AWS_REGION!, // 認証情報はデフォルトの AWS プロバイダーチェーンを使用
  },
  // オプション: インデックス作成時に大きな/長文フィールドをフィルター不可として指定
  nonFilterableMetadataKeys: ['content'],
});

// インデックスを作成（名前は正規化される: "_" → "-" に変換し小文字化）
await store.createIndex({
  indexName: 'my_index',
  dimension: 1536,
  metric: 'cosine', // "euclidean" もサポート; "dotproduct" は非対応
});

// ベクトルをアップサート（省略時は id 自動生成）。メタデータ内の日付はエポック ms にシリアライズされる。
const ids = await store.upsert({
  indexName: 'my_index',
  vectors: [
    [0.1, 0.2 /* … */],
    [0.3, 0.4 /* … */],
  ],
  metadata: [
    { text: 'doc1', genre: 'documentary', year: 2023, createdAt: new Date('2024-01-01') },
    { text: 'doc2', genre: 'comedy', year: 2021 },
  ],
});

// メタデータフィルターでクエリ（暗黙の AND を正規化）
const results = await store.query({
  indexName: 'my-index',
  queryVector: [0.1, 0.2 /* … */],
  topK: 10, // サービス側の上限が適用される場合あり（一般的に 30）
  filter: { genre: { $in: ['documentary', 'comedy'] }, year: { $gte: 2020 } },
  includeVector: false, // 生のベクトルを含めるには true（追加の取得が発生する可能性あり）
});

// リソースを後処理（基盤の HTTP ハンドラーをクローズ）
await store.disconnect();
```

## コンストラクターのオプション \{#constructor-options\}

<PropertiesTable
  content={[
{
name: "vectorBucketName",
type: "string",
description: "対象の S3 Vectors のベクターバケット名。",
},
{
name: "clientConfig",
type: "S3VectorsClientConfig",
isOptional: true,
description: "AWS SDK v3 のクライアントオプション（例：`region`、`credentials`）。",
},
{
name: "nonFilterableMetadataKeys",
type: "string[]",
isOptional: true,
description: "フィルタ不可にするメタデータキー（作成時にインデックスへ適用）。`content` のような大きなテキストフィールドに使用してください。",
},
]}
/>

## 方法 \{#methods\}

### createIndex() \{#createindex\}

設定済みのベクターバケットに新しいベクターインデックスを作成します。インデックスが既に存在する場合は、スキーマを検証し、実質的に何も行いません（既存のメトリックと次元は保持されます）。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "論理インデックス名。内部で正規化されます：アンダースコアはハイフンに置き換えられ、名前は小文字化されます。",
},
{
name: "dimension",
type: "number",
description: "ベクターの次元数（使用する埋め込みモデルと一致している必要があります）",
},
{
name: "metric",
type: "'cosine' | 'euclidean'",
isOptional: true,
defaultValue: "cosine",
description: "類似検索の距離指標。`dotproduct` は S3 Vectors ではサポートされていません。",
},
]}
/>

### upsert() \{#upsert\}

ベクターを追加または置換します（レコード全体の書き込み）。`ids` が指定されていない場合は、UUID が生成されます。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "upsert 先のインデックス名",
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
description: "任意のベクター ID（未指定の場合は自動生成）",
},
]}
/>

### query() \{#query\}

オプションのメタデータフィルタを使って最近傍を検索します。

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
description: "類似ベクトルを見つけるためのクエリベクトル",
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
type: "S3VectorsFilter",
isOptional: true,
description: "JSONベースのメタデータフィルタ。`$and`、`$or`、`$eq`、`$ne`、`$gt`、`$gte`、`$lt`、`$lte`、`$in`、`$nin`、`$exists` をサポートします。",
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

> **スコアリング:** 結果には `score = 1/(1 + distance)` が含まれ、基礎となる距離の順位づけを保ちつつ、値が高いほど良い指標となります。

### describeIndex() \{#describeindex\}

インデックスの情報を返します。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "説明するインデックスの名前。",
},
]}
/>

戻り値:

```typescript copy
interface IndexStats {
  dimension: number;
  count: number; // ListVectors のページネーションを通じて計算されます (O(n))
  metric: 'cosine' | 'euclidean';
}
```

### deleteIndex() \{#deleteindex\}

インデックス本体とそのデータを削除します。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "削除するインデックス名。",
},
]}
/>

### listIndexes() \{#listindexes\}

設定されたベクターバケット内のすべてのインデックスを一覧します。

Returns: `Promise<string[]>`

### updateVector() \{#updatevector\}

インデックス内の特定のIDに対して、ベクターまたはメタデータを更新します。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "ベクターを含むインデックス。",
},
{
name: "id",
type: "string",
description: "更新対象のID。",
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

指定した ID のベクトルを削除します。

<PropertiesTable
  content={[
{
name: "indexName",
type: "string",
description: "ベクトルを含むインデックス。",
},
{
name: "id",
type: "string",
description: "削除する ID。",
},
]}
/>

### disconnect() \{#disconnect\}

基盤となる AWS SDK の HTTP ハンドラーをクローズして、ソケットを解放します。

## レスポンスの種類 \{#response-types\}

クエリ結果は次の形式で返されます：

```typescript copy
interface QueryResult {
  id: string;
  score: number; // 1/(1 + distance)
  metadata: Record<string, any>;
  vector?: number[]; // includeVector が true の場合のみ含まれます
}
```

## フィルター構文 \{#filter-syntax\}

S3 Vectors は、演算子と値型の厳密なサブセットのみをサポートします。Mastra フィルター変換器は次を行います:

* **暗黙の AND の正規化**: `{a:1,b:2}` → `{ $and: [{a:1},{b:2}] }`
* **Date 値を正規化** し、数値比較や配列要素用にエポック ms に変換
* 等価位置（`field: value` または `$eq/$ne`）での **Date は不可**。等価の値は **string | number | boolean** に限る
* 等価における null/undefined を **拒否**。**配列の等価** は非対応（`$in`/`$nin` を使用）
* 最上位の論理演算子として許可されるのは **`$and` / `$or`** のみ
* 論理演算子は **フィールド条件** を含む必要がある（直接の演算子は不可）

**サポートされる演算子:**

* **論理:** `$and`, `$or`（空でない配列）
* **基本:** `$eq`, `$ne`（string | number | boolean）
* **数値:** `$gt`, `$gte`, `$lt`, `$lte`（number または `Date` → エポック ms）
* **配列:** `$in`, `$nin`（string | number | boolean の空でない配列；`Date` → エポック ms）
* **要素:** `$exists`（boolean）

**非対応 / 不許可（拒否）:** `$not`, `$nor`, `$regex`, `$all`, `$elemMatch`, `$size`, `$text` など

**例:**

```typescript copy
// 暗黙の AND
{ genre: { $in: ["documentary", "comedy"] }, year: { $gte: 2020 } }

// 論理演算子と範囲を明示的に指定
{
  $and: [
    { price: { $gte: 100, $lte: 1000 } },
    { $or: [{ stock: { $gt: 0 } }, { preorder: true }] }
  ]
}

// 範囲内の日付（エポックミリ秒に変換済み）
{ timestamp: { $gt: new Date("2024-01-01T00:00:00Z") } }
```

> **フィルタ不可のキー:** インデックス作成時に `nonFilterableMetadataKeys` を設定すると、それらのキーは保存されますが、フィルタとして使用することは**できません**。

## エラー処理 \{#error-handling\}

ストアは、キャッチ可能な型付きエラーをスローします:

```typescript copy
try {
  await store.query({
    indexName: 'index-name',
    queryVector: queryVector,
  });
} catch (error) {
  if (error instanceof VectorStoreError) {
    console.log(error.code); // 'connection_failed' | 'invalid_dimension' | など
    console.log(error.details); // エラーの詳細情報
  }
}
```

## 環境変数 \{#environment-variables\}

アプリを構成する際によく使う環境変数:

* `S3_VECTORS_BUCKET_NAME`: S3 の**ベクターバケット**名（`vectorBucketName` に設定するために使用）。
* `AWS_REGION`: S3 Vectors バケットの AWS リージョン。
* **AWS 認証情報**: 標準の AWS SDK プロバイダーチェーン（`AWS_ACCESS_KEY_ID`、`AWS_SECRET_ACCESS_KEY`、`AWS_PROFILE` など）を通じて指定。

## ベストプラクティス \{#best-practices\}

* メトリック（`cosine` または `euclidean`）は使用する埋め込みモデルに合わせて選択してください。`dotproduct` はサポートされていません。
* **フィルタ可能**なメタデータは小さく、構造化（string/number/boolean）して保つこと。大きなテキスト（例：`content`）は**非フィルタ可能**として保存します。
* ネストされたメタデータには**ドット表記のパス**を使用し、複雑なロジックには `$and`/`$or` を明示的に使用します。
* ホットパスで `describeIndex()` を呼び出すのは避けてください。`count` はページネーションされた `ListVectors` によって計算され（**O(n)**）ます。
* 生のベクトルが必要な場合にのみ `includeVector: true` を使用してください。

## 関連項目 \{#related\}

* [メタデータフィルタ](../rag/metadata-filters)