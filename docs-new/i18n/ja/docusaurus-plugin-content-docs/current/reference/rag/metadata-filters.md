---
title: "リファレンス：メタデータフィルター"
description: Mastra のメタデータフィルタリング機能に関するドキュメント。複数のベクターストアにまたがるベクター検索結果に対して、精密なクエリを実行できます。
---

# メタデータフィルタ \{#metadata-filters\}

Mastra は、MongoDB/Sift のクエリ構文に基づく統一的なメタデータフィルタ構文を、すべてのベクトルストアで利用できる形で提供します。各ベクトルストアは、これらのフィルタを自分たちのネイティブ形式に変換します。

## 基本例 \{#basic-example\}

```typescript
import { PgVector } from '@mastra/pg';

const store = new PgVector({ connectionString });

const results = await store.query({
  indexName: 'my_index',
  queryVector: queryVector,
  topK: 10,
  filter: {
    category: 'electronics', // 単純な等価比較
    price: { $gt: 100 }, // 数値の比較
    tags: { $in: ['sale', 'new'] }, // 配列の包含
  },
});
```

## 対応オペレーター \{#supported-operators\}

<OperatorsTable
  title="基本比較"
  operators={[
{
name: "$eq",
    description: "指定した値と等しい値に一致",
    example: "{ age: { $eq: 25 } }",
    supportedBy: ["Couchbase を除くすべて"],
  },
  {
    name: "$ne",
description: "指定した値と等しくない値に一致",
example: "{ status: { $ne: 'inactive' } }",
    supportedBy: ["Couchbase を除くすべて"],
  },
  {
    name: "$gt",
description: "より大きい",
example: "{ price: { $gt: 100 } }",
    supportedBy: ["Couchbase を除くすべて"],
  },
  {
    name: "$gte",
description: "以上",
example: "{ rating: { $gte: 4.5 } }",
    supportedBy: ["Couchbase を除くすべて"],
  },
  {
    name: "$lt",
description: "より小さい",
example: "{ stock: { $lt: 20 } }",
    supportedBy: ["Couchbase を除くすべて"],
  },
  {
    name: "$lte",
description: "以下",
example: "{ priority: { $lte: 3 } }",
supportedBy: ["Couchbase を除くすべて"],
},
]}
/>

<OperatorsTable
  title="配列オペレーター"
  operators={[
{
name: "$in",
    description: "配列内のいずれかの値に一致",
    example: '{ category: { $in: ["A", "B"] } }',
    supportedBy: ["Couchbase を除くすべて"],
  },
  {
    name: "$nin",
description: "いずれの値にも一致しない",
example: '{ status: { $nin: ["deleted", "archived"] } }',
    supportedBy: ["Couchbase を除くすべて"],
  },
  {
    name: "$all",
description: "すべての要素を含む配列に一致",
example: '{ tags: { $all: ["urgent", "high"] } }',
    supportedBy: ["Astra", "Pinecone", "Upstash", "MongoDB"],
  },
  {
    name: "$elemMatch",
description: "条件を満たす配列要素に一致",
example: "{ scores: { $elemMatch: { $gt: 80 } } }",
supportedBy: ["LibSQL", "PgVector", "MongoDB"],
},
]}
/>

<OperatorsTable
  title="論理オペレーター"
  operators={[
{
name: "$and",
    description: "論理 AND",
    example: "{ $and: [{ price: { $gt: 100 } }, { stock: { $gt: 0 } }] }",
    supportedBy: ["Vectorize と Couchbase を除くすべて"],
  },
  {
    name: "$or",
description: "論理 OR",
example: '{ $or: [{ status: "active" }, { priority: "high" }] }',
    supportedBy: ["Vectorize と Couchbase を除くすべて"],
  },
  {
    name: "$not",
description: "論理 NOT",
example: "{ price: { $not: { $lt: 100 } } }",
    supportedBy: [
      "Astra",
      "Qdrant",
      "Upstash",
      "PgVector",
      "LibSQL",
      "MongoDB",
    ],
  },
  {
    name: "$nor",
description: "論理 NOR",
example: '{ $nor: [{ status: "deleted" }, { archived: true }] }',
supportedBy: ["Qdrant", "Upstash", "PgVector", "LibSQL", "MongoDB"],
},
]}
/>

<OperatorsTable
  title="要素オペレーター"
  operators={[
{
name: "$exists",
description: "指定フィールドを持つドキュメントに一致",
example: "{ rating: { $exists: true } }",
supportedBy: ["Vectorize、Chroma、Couchbase を除くすべて"],
},
]}
/>

<OperatorsTable
  title="カスタム演算子"
  operators={[
{
name: "$contains",
    description: "テキストに部分文字列が含まれる",
    example: '{ description: { $contains: "sale" } }',
    supportedBy: ["Upstash", "LibSQL", "PgVector"],
  },
  {
    name: "$regex",
description: "正規表現によるマッチ",
example: '{ name: { $regex: "^test" } }',
    supportedBy: ["Qdrant", "PgVector", "Upstash", "MongoDB"],
  },
  {
    name: "$size",
description: "配列の長さのチェック",
example: "{ tags: { $size: { $gt: 2 } } }",
    supportedBy: ["Astra", "LibSQL", "PgVector", "MongoDB"],
  },
  {
    name: "$geo",
description: "地理空間クエリ",
example: '{ location: { $geo: { type: "radius", ... } } }',
    supportedBy: ["Qdrant"],
  },
  {
    name: "$datetime",
description: "日時範囲のクエリ",
example: '{ created: { $datetime: { range: { gt: "2024-01-01" } } } }',
    supportedBy: ["Qdrant"],
  },
  {
    name: "$hasId",
description: "ベクトルIDの存在チェック",
example: '{ $hasId: ["id1", "id2"] }',
    supportedBy: ["Qdrant"],
  },
  {
    name: "$hasVector",
description: "ベクトルの存在チェック",
example: "{ $hasVector: true }",
supportedBy: ["Qdrant"],
},
]}
/>

## 共通ルールと制約 \{#common-rules-and-restrictions\}

1. フィールド名は次を満たす必要があります:
   * ネストされたフィールドを参照する場合を除き、ドット (.) を含まない
   * 先頭を $ で始めない、かつ null 文字を含まない
   * 空文字列にしない

2. 値は次のとおりでなければなりません:
   * 有効な JSON 型（string、number、boolean、object、array）
   * undefined ではない
   * 演算子に対して適切な型である（例: 数値比較には number）

3. 論理演算子:
   * 有効な条件を含むこと
   * 空でないこと
   * 適切にネストされていること
   * トップレベル、または他の論理演算子内にネストしてのみ使用可能
   * フィールドレベルやフィールド内にネストして使用不可
   * 他の演算子の内部では使用不可
   * 有効: `{ "$and": [{ "field": { "$gt": 100 } }] }`
   * 有効: `{ "$or": [{ "$and": [{ "field": { "$gt": 100 } }] }] }`
   * 無効: `{ "field": { "$and": [{ "$gt": 100 }] } }`
   * 無効: `{ "field": { "$gt": { "$and": [{...}] } } }`

4. $not 演算子:
   * オブジェクトであること
   * 空でないこと
   * フィールドレベルまたはトップレベルで使用可能
   * 有効: `{ "$not": { "field": "value" } }`
   * 有効: `{ "field": { "$not": { "$eq": "value" } } }`

5. 演算子のネスト:
   * 論理演算子は、演算子そのものではなくフィールド条件を含める必要がある
   * 有効: `{ "$and": [{ "field": { "$gt": 100 } }] }`
   * 無効: `{ "$and": [{ "$gt": 100 }] }`

## ストア別の注意事項 \{#store-specific-notes\}

### Astra \{#astra\}

* ネストされたフィールドのクエリはドット表記でサポートされています
* 配列フィールドはメタデータで配列として明示的に定義する必要があります
* メタデータの値は大文字小文字を区別します

### ChromaDB \{#chromadb\}

* フィルターは、メタデータ内に対象フィールドが存在する場合にのみ結果を返します
* 空のメタデータフィールドはフィルター結果に含まれません
* 否定条件で一致させるには、そのメタデータフィールドが存在している必要があります（例：$ne はそのフィールドが存在しないドキュメントには一致しません）

### Cloudflare Vectorize \{#cloudflare-vectorize\}

* フィルタリングを利用するには、メタデータの明示的なインデックス作成が必要
* フィルタ対象のフィールドをインデックス化するには `createMetadataIndex()` を使用
* Vectorize インデックスあたりメタデータインデックスは最大 10 個
* 文字列は先頭 64 バイトまでインデックス化（UTF-8 の境界で切り詰め）
* 数値は float64 精度を使用
* フィルター用 JSON は 2048 バイト未満である必要がある
* フィールド名にドット (.) を含めたり、$ で始めたりできない
* フィールド名は最大 512 文字
* 新しいメタデータインデックスを作成した後、フィルタ結果に反映させるにはベクターを再アップサートする必要がある
* 非常に大規模なデータセット（約 1,000 万ベクター超）では、範囲クエリの精度が低下する場合がある

### LibSQL \{#libsql\}

* ドット記法によるネストされたオブジェクトのクエリをサポート
* 配列フィールドは、有効な JSON 配列であることを検証
* 数値の比較では適切な型を維持して処理
* 条件内の空配列を適切に扱う
* メタデータは効率的なクエリのために JSONB カラムに格納

### PgVector \{#pgvector\}

* PostgreSQL のネイティブな JSON クエリ機能を完全サポート
* ネイティブの配列関数による配列操作の効率的な処理
* 数値、文字列、ブール値の適切な型ハンドリング
* ネストされたフィールドのクエリは内部的に PostgreSQL の JSON パス構文を使用
* メタデータは効率的なインデックス作成のために JSONB 列に保存

### Pinecone \{#pinecone\}

* メタデータのフィールド名は512文字以内です
* 数値は ±1e38 の範囲に収める必要があります
* メタデータ内の配列は合計サイズが 64KB に制限されます
* ネストされたオブジェクトはドット表記でフラット化されます
* メタデータの更新はメタデータオブジェクト全体を置き換えます

### Qdrant \{#qdrant\}

* ネストした条件による高度なフィルタリングをサポート
* フィルタリングを行うには、Payload（メタデータ）フィールドを明示的にインデックス化する必要がある
* 位置情報（ジオスペーシャル）クエリを効率的に処理
* null および空値を特別に取り扱い
* ベクター特有のフィルタリング機能
* 日時値は RFC 3339 形式で指定する必要がある

### Upstash \{#upstash\}

* メタデータフィールドのキーは最大512文字
* クエリサイズに制限あり（大きな IN 句は避ける）
* フィルターでの null/undefined は非対応
* 内部的に SQL 風の構文へ変換される
* 文字列比較は大文字・小文字を区別
* メタデータの更新はアトミックに行われる

### MongoDB \{#mongodb\}

* メタデータフィルタ用の MongoDB/Sift クエリ構文を完全サポート
* 標準的な比較・配列・論理・要素オペレーターをすべてサポート
* メタデータ内のネストされたフィールドや配列に対応
* `filter` と `documentFilter` オプションを使って、`metadata` と元のドキュメント内容の両方にフィルタリングを適用可能
* `filter` はメタデータオブジェクトに、`documentFilter` は元のドキュメントのフィールドに適用
* フィルタのサイズや複雑さに人工的な制限なし（MongoDB のクエリ制限に準拠）
* 最適なパフォーマンスのため、メタデータフィールドのインデックス化を推奨

### Couchbase \{#couchbase\}

* 現在、メタデータフィルターはサポートされていません。フィルタリングは結果取得後にクライアント側で行うか、より複雑なクエリの場合は Couchbase SDK の Search 機能を直接使用してください。

### Amazon S3 Vectors \{#amazon-s3-vectors\}

* 等価比較に使える値はプリミティブ（string/number/boolean）のみです。`null`/`undefined`、配列、オブジェクト、Date は等価比較に使用できません。範囲演算子は number または Date を受け付けます（Date はエポックミリ秒に正規化されます）。
* `$in`/`$nin` には、**空でないプリミティブの配列**が必要です。Date 要素は使用可能で、エポックミリ秒に正規化されます。**配列の等価比較**はサポートされていません。
* 暗黙の AND は正規化されます（`{a:1,b:2}` → `{$and:[{a:1},{b:2}]}`）。論理演算子にはフィールド条件を含め、空でない配列を用い、ルートまたは他の論理演算子内にのみ記述してください（フィールド値の内部は不可）。
* インデックス作成時に `nonFilterableMetadataKeys` に指定したキーは保存されますがフィルタ不可です。この設定は変更できません。
* $exists には boolean 値が必要です。
* undefined/null/空のフィルタは、フィルタなしとして扱われます。
* 各メタデータキー名は最大 63 文字。
* ベクターあたりのメタデータ合計: 最大 40 KB（フィルタ可能 + フィルタ不可）
* ベクターあたりのメタデータキー数: 最大 10
* ベクターあたりのフィルタ可能メタデータ: 最大 2 KB
* ベクターインデックスあたりのフィルタ不可メタデータキー数: 最大 10

## 関連項目 \{#related\}

* [Astra](/docs/reference/vectors/astra)
* [Chroma](/docs/reference/vectors/chroma)
* [Cloudflare Vectorize](/docs/reference/vectors/vectorize)
* [LibSQL](/docs/reference/vectors/libsql)
* [MongoDB](/docs/reference/vectors/mongodb)
* [PgStore](/docs/reference/vectors/pg)
* [Pinecone](/docs/reference/vectors/pinecone)
* [Qdrant](/docs/reference/vectors/qdrant)
* [Upstash](/docs/reference/vectors/upstash)
* [Amazon S3 Vectors](/docs/reference/vectors/s3vectors)