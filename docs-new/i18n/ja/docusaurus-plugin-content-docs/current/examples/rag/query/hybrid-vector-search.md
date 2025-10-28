---
title: "ハイブリッド・ベクトル検索"
description: Mastra において、PGVector とメタデータフィルターを用いてベクトル検索の結果を向上させる例。
---

# ハイブリッドベクター検索 \{#hybrid-vector-search\}

ベクトル類似検索にメタデータフィルターを組み合わせると、より正確かつ効率的なハイブリッド検索を実現できます。
このアプローチでは、次の要素を組み合わせます:

* 最も関連性の高いドキュメントを見つけるためのベクトル類似検索
* 追加の条件に基づいて検索結果を絞り込むメタデータフィルター

この例では、Mastra と PGVector を用いたハイブリッドベクター検索の使い方を示します。

## 概要 \{#overview\}

このシステムは、Mastra と PGVector を用いたフィルタ付きベクトル検索を実装しています。主な機能は次のとおりです。

1. メタデータのフィルタを使って PGVector 内の既存の埋め込みを照会する
2. さまざまなメタデータフィールドでのフィルタ方法を示す
3. ベクトル類似度とメタデータフィルタリングの組み合わせをデモする

> 注記: ドキュメントからメタデータを抽出する方法の例については、[Metadata Extraction](../embedding/metadata-extraction) ガイドを参照してください。
>
> 埋め込みの作成と保存方法については、[Upsert Embeddings](/docs/examples/rag/upsert/upsert-embeddings) ガイドを参照してください。

## セットアップ \{#setup\}

### 環境設定 \{#environment-setup\}

環境変数を必ず設定してください：

```bash filename=".env"
OPENAI_API_KEY=your_openai_api_key_here
POSTGRES_CONNECTION_STRING=your_connection_string_here
```

### 依存関係 \{#dependencies\}

必要な依存関係をインポートします：

```typescript copy showLineNumbers filename="src/index.ts"
import { embed } from 'ai';
import { PgVector } from '@mastra/pg';
import { openai } from '@ai-sdk/openai';
```

## ベクターストアの初期化 \{#vector-store-initialization\}

接続文字列を使って PgVector を初期化します：

```typescript copy showLineNumbers{4} filename="src/index.ts"
const pgVector = new PgVector({
  connectionString: process.env.POSTGRES_CONNECTION_STRING!,
});
```

## 使用例 \{#example-usage\}

### メタデータ値で絞り込む \{#filter-by-metadata-value\}

```typescript copy showLineNumbers{6} filename="src/index.ts"
// クエリの埋め込みを作成
const { embedding } = await embed({
  model: openai.embedding('text-embedding-3-small'),
  value: '[ドキュメントに基づいたクエリをここに挿入]',
});

// メタデータフィルターを使用してクエリを実行
const result = await pgVector.query({
  indexName: 'embeddings',
  queryVector: embedding,
  topK: 3,
  filter: {
    'path.to.metadata': {
      $eq: 'value',
    },
  },
});

console.log('結果:', result);
```

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/rag/hybrid-vector-search"
}
/>
