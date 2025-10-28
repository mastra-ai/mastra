---
title: "埋め込みモデル"
description: "Mastra のモデルルーター経由で埋め込みモデルを利用し、セマンティック検索と RAG を実現します。"
sidebar_position: 2
---

# 埋め込みモデル \{#embedding-models\}

Mastra のモデルルーターは、言語モデルと同じ `provider/model` 文字列形式で埋め込みモデルをサポートします。これにより、TypeScript のオートコンプリートに対応した、チャットモデルと埋め込みモデルの両方に対する統一的なインターフェースが提供されます。

## クイックスタートガイド \{#quick-start\}

```typescript
import { ModelRouterEmbeddingModel } from '@mastra/core';
import { embedMany } from 'ai';

// 埋め込みモデルを作成
const embedder = new ModelRouterEmbeddingModel('openai/text-embedding-3-small');

// 埋め込みを生成
const { embeddings } = await embedMany({
  model: embedder,
  values: ['Hello world', 'Semantic search is powerful'],
});
```

## 対応モデル \{#supported-models\}

### OpenAI \{#openai\}

* `text-embedding-3-small` - 1536 次元、最大 8191 トークン
* `text-embedding-3-large` - 3072 次元、最大 8191 トークン
* `text-embedding-ada-002` - 1536 次元、最大 8191 トークン

```typescript
const embedder = new ModelRouterEmbeddingModel('openai/text-embedding-3-small');
```

### Google \{#google\}

* `gemini-embedding-001` - 768次元（推奨）、最大トークン数: 2048
* `text-embedding-004` - 768次元、最大トークン数: 3072

```typescript
const embedder = new ModelRouterEmbeddingModel('google/gemini-embedding-001');
```

## 認証 \{#authentication\}

モデルルーターは環境変数から API キーを自動検出します：

* **OpenAI**: `OPENAI_API_KEY`
* **Google**: `GOOGLE_GENERATIVE_AI_API_KEY`

```bash title="env"
OPENAI_API_KEY=sk-...
GOOGLE_GENERATIVE_AI_API_KEY=...
```

## カスタムプロバイダー \{#custom-providers\}

任意のOpenAI互換の埋め込みエンドポイントを、カスタムURLで利用できます。

```typescript
import { ModelRouterEmbeddingModel } from '@mastra/core';

const embedder = new ModelRouterEmbeddingModel({
  providerId: 'ollama',
  modelId: 'nomic-embed-text',
  url: 'http://localhost:11434/v1',
  apiKey: 'not-needed', // 一部のプロバイダーではAPIキーは不要です
});
```

## メモリとの併用 \{#usage-with-memory\}

埋め込みモデルルーターは、Mastra のメモリシステムとシームレスに統合されます。

```typescript
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは親切なアシスタントです',
  model: 'openai/gpt-4o',
  memory: new Memory({
    embedder: 'openai/text-embedding-3-small', // 自動補完機能付きの文字列
  }),
});
```

:::note
`embedder` フィールドでは次の値を受け付けます：

* `EmbeddingModelId`（オートコンプリート対応の文字列）
* `EmbeddingModel<string>`（AI SDK v1）
* `EmbeddingModelV2<string>`（AI SDK v2）
  :::

## RAG での利用 \{#usage-with-rag\}

ドキュメントの分割と検索には埋め込みモデルを使用します：

```typescript
import { ModelRouterEmbeddingModel } from '@mastra/core';
import { embedMany } from 'ai';

const embedder = new ModelRouterEmbeddingModel('openai/text-embedding-3-small');

// ドキュメントチャンクを埋め込む
const { embeddings } = await embedMany({
  model: embedder,
  values: chunks.map(chunk => chunk.text),
});

// ベクトルデータベースに埋め込みを保存する
await vectorStore.upsert(
  chunks.map((chunk, i) => ({
    id: chunk.id,
    vector: embeddings[i],
    metadata: chunk.metadata,
  })),
);
```

## TypeScript サポート \{#typescript-support\}

モデルルーターは、埋め込みモデルのIDに対して完全な TypeScript のオートコンプリートを提供します。

```typescript
import type { EmbeddingModelId } from '@mastra/core';

// 型安全な埋め込みモデルの選択
const modelId: EmbeddingModelId = 'openai/text-embedding-3-small';
//                                  ^ オートコンプリートでサポート対象のモデルがすべて表示されます

const embedder = new ModelRouterEmbeddingModel(modelId);
```

## エラー処理 \{#error-handling\}

モデルルーターは、作成時にプロバイダーとモデルのIDを検証します。

```typescript
try {
  const embedder = new ModelRouterEmbeddingModel('invalid/model');
} catch (error) {
  console.error(error.message);
  // 「不明なプロバイダー: invalid。利用可能なプロバイダー: openai, google」
}
```

APIキーの欠如も早期に検出されます：

```typescript
try {
  const embedder = new ModelRouterEmbeddingModel('openai/text-embedding-3-small');
  // OPENAI_API_KEYが設定されていない場合は例外をスローします
} catch (error) {
  console.error(error.message);
  // "API key not found for provider openai. Set OPENAI_API_KEY environment variable."
}
```

## 次のステップ \{#next-steps\}

* [Memory &amp; Semantic Recall](/docs/memory/semantic-recall) - エージェントのメモリに埋め込みを活用する
* [RAG &amp; Chunking](/docs/rag/chunking-and-embedding) - 検索拡張生成（RAG）システムを構築する
* [Vector Databases](/docs/rag/vector-databases) - 埋め込みを保存・検索する