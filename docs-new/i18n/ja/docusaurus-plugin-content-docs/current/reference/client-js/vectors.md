---
title: Mastra クライアント Vectors API
description: client-js SDK を使って、Mastra でセマンティック検索や類似度マッチングに用いるベクトル埋め込みの扱い方を学びます。
---

# Vectors API \{#vectors-api\}

Vectors API は、Mastra におけるセマンティック検索や類似度マッチングのためのベクトル埋め込みを扱うためのメソッドを提供します。

## ベクトルの扱い方 \{#working-with-vectors\}

ベクトルストアのインスタンスを取得します：

```typescript
const vector = mastraClient.getVector('vector-name');
```

## ベクトルのメソッド \{#vector-methods\}

### ベクターインデックスの詳細を取得 \{#get-vector-index-details\}

特定のベクターインデックスの情報を取得します。

```typescript
const details = await vector.details('index-name');
```

### ベクトルインデックスを作成 \{#create-vector-index\}

新しいベクトルインデックスを作成します。

```typescript
const result = await vector.createIndex({
  indexName: 'new-index',
  dimension: 128,
  metric: 'cosine', // 'cosine'、'euclidean'、'dotproduct' のいずれか
});
```

### ベクトルのアップサート \{#upsert-vectors\}

インデックスにベクトルを追加または更新します:

```typescript
const ids = await vector.upsert({
  indexName: 'my-index',
  vectors: [
    [0.1, 0.2, 0.3], // 1つ目のベクトル
    [0.4, 0.5, 0.6], // 2つ目のベクトル
  ],
  metadata: [{ label: 'first' }, { label: 'second' }],
  ids: ['id1', 'id2'], // オプション: カスタムID
});
```

### クエリベクトル \{#query-vectors\}

類似ベクトルを検索します：

```typescript
const results = await vector.query({
  indexName: 'my-index',
  queryVector: [0.1, 0.2, 0.3],
  topK: 10,
  filter: { label: 'first' }, // オプション:メタデータフィルター
  includeVector: true, // オプション:結果にベクトルを含める
});
```

### すべてのインデックスを取得 \{#get-all-indexes\}

利用可能なインデックスをすべて一覧表示します:

```typescript
const indexes = await vector.getIndexes();
```

### インデックスの削除 \{#delete-index\}

ベクターインデックスを削除する:

```typescript
const result = await vector.delete('index-name');
```
