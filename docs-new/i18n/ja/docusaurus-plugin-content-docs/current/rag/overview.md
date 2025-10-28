---
title: 概要
description: Mastra における Retrieval-Augmented Generation（RAG）の概要。関連するコンテキストを用いて LLM の出力を強化する機能について説明します。
sidebar_position: 1
---

# Mastra における RAG（Retrieval-Augmented Generation） \{#rag-retrieval-augmented-generation-in-mastra\}

Mastra の RAG は、独自のデータソースから関連するコンテキストを取り込むことで LLM の出力を強化し、精度を向上させ、実データに基づく応答を実現します。

Mastra の RAG システムは次を提供します：

* ドキュメントの処理と埋め込みのための標準化 API
* 複数のベクターストアのサポート
* 最適な検索のためのチャンク分割と埋め込み戦略
* 埋め込みおよび検索パフォーマンスを可視化・追跡するための機能

## 例 \{#example\}

RAG を実装するには、ドキュメントをチャンクに分割し、埋め込みを作成してベクターデータベースに保存し、クエリ時に関連するコンテキストを取得します。

```ts showLineNumbers copy
import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { PgVector } from '@mastra/pg';
import { MDocument } from '@mastra/rag';
import { z } from 'zod';

// 1. ドキュメントを初期化
const doc = MDocument.fromText(`ここにドキュメントのテキストを入力...`);

// 2. チャンクを作成
const chunks = await doc.chunk({
  strategy: 'recursive',
  size: 512,
  overlap: 50,
});

// 3. 埋め込みを生成; 各チャンクのテキストを渡す必要があります
const { embeddings } = await embedMany({
  values: chunks.map(chunk => chunk.text),
  model: openai.embedding('text-embedding-3-small'),
});

// 4. ベクトルデータベースに保存
const pgVector = new PgVector({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
});
await pgVector.upsert({
  indexName: 'embeddings',
  vectors: embeddings,
}); // インデックス名として 'embeddings' を使用

// 5. 類似チャンクをクエリ
const results = await pgVector.query({
  indexName: 'embeddings',
  queryVector: queryVector,
  topK: 3,
}); // queryVector はクエリの埋め込みです

console.log('類似チャンク:', results);
```

この例では基本的な流れを示します。ドキュメントを初期化し、チャンクを作成し、埋め込みを生成して保存し、類似コンテンツを検索します。

## ドキュメント処理 \{#document-processing\}

RAG の基本的な構成要素はドキュメント処理です。ドキュメントは、再帰的分割やスライディングウィンドウなどのさまざまな手法でチャンク化でき、メタデータで補強できます。詳しくは [チャンク化と埋め込みに関するドキュメント](./chunking-and-embedding) を参照してください。

## ベクターストレージ \{#vector-storage\}

Mastra は、埋め込みの永続化と類似検索のために、pgvector、Pinecone、Qdrant、MongoDB など複数のベクターストアをサポートしています。詳しくは[ベクターデータベースに関するドキュメント](./vector-databases)をご覧ください。

## 可観測性とデバッグ \{#observability-and-debugging\}

Mastra の RAG システムには、リトリーバル・パイプラインの最適化に役立つ可観測性機能が備わっています：

* Embedding 生成のパフォーマンスとコストの追跡
* チャンク品質とリトリーバルの適合度の監視
* クエリパターンとキャッシュヒット率の分析
* メトリクスの可観測性プラットフォームへのエクスポート

詳しくは [OTel Configuration](/docs/reference/observability/otel-tracing/otel-config) ページをご覧ください。

## さらに詳しい資料 \{#more-resources\}

* [Chain of Thought RAG の例](/docs/examples/rag/usage/cot-rag)
* [RAG の全例](/docs/examples/)（さまざまなチャンク分割戦略、埋め込みモデル、ベクターストアを含む）