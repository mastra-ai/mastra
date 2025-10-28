---
title: PostgreSQL を使ったメモリ
description: Mastra のメモリシステムを、PostgreSQL のストレージとベクトル機能で活用する方法の例。
sidebar_position: 2
---

# PostgreSQL を使ったメモリ \{#memory-with-postgres\}

この例では、ストレージのバックエンドに PostgreSQL を用いて Mastra のメモリシステムを使う方法を示します。

## 前提条件 \{#prerequisites\}

この例では `openai` モデルを使用し、`pgvector` 拡張機能が有効な PostgreSQL データベースが必要です。以下を `.env` ファイルに追加してください:

```bash title=".env" copy
OPENAI_API_KEY=<APIキー>
DATABASE_URL=<接続文字列>
```

次のパッケージをインストールします：

```bash copy
npm install @mastra/pg
```

## エージェントにメモリを追加する \{#adding-memory-to-an-agent\}

エージェントに PostgreSQL のメモリを追加するには、`Memory` クラスを使用し、`PostgresStore` で新しい `storage` キーを作成します。`connectionString` にはリモートの接続先またはローカルのデータベース接続を指定できます。

```typescript title="src/mastra/agents/example-pg-agent.ts" showLineNumbers copy
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { PostgresStore } from '@mastra/pg';

export const pgAgent = new Agent({
  name: 'pg-agent',
  instructions: 'あなたは過去のやり取りの内容を自動的に想起できるAIエージェントです。',
  model: openai('gpt-4o'),
  memory: new Memory({
    storage: new PostgresStore({
      connectionString: process.env.DATABASE_URL!,
    }),
    options: {
      threads: {
        generateTitle: true,
      },
    },
  }),
});
```

## fastembed を使ったローカル埋め込み \{#local-embeddings-with-fastembed\}

埋め込みは、memory の `semanticRecall` が（キーワードではなく）意味に基づいて関連メッセージを検索するために用いる数値ベクトルです。このセットアップでは、`@mastra/fastembed` を使ってベクトル埋め込みを生成します。

まずは `fastembed` をインストールします:

```bash copy
npm install @mastra/fastembed
```

エージェントに次の項目を追加してください：

```typescript title="src/mastra/agents/example-pg-agent.ts" showLineNumbers copy
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { PostgresStore, PgVector } from '@mastra/pg';
import { fastembed } from '@mastra/fastembed';

export const pgAgent = new Agent({
  name: 'pg-agent',
  instructions: 'あなたは過去のやり取りを自動的に想起できるAIエージェントです。',
  model: openai('gpt-4o'),
  memory: new Memory({
    storage: new PostgresStore({
      connectionString: process.env.DATABASE_URL!,
    }),
    vector: new PgVector({
      connectionString: process.env.DATABASE_URL!,
    }),
    embedder: fastembed,
    options: {
      lastMessages: 10,
      semanticRecall: {
        topK: 3,
        messageRange: 2,
      },
    },
  }),
});
```

## 使用例 \{#usage-example\}

このリクエストでの参照範囲を制御するには `memoryOptions` を使用します。直近ベースの参照を絞るために `lastMessages: 5` を設定し、`semanticRecall` を使って、各一致の前後の文脈として `messageRange: 2` の隣接メッセージを含めつつ、最も関連性の高いメッセージ `topK: 3` を取得します。

```typescript title="src/test-pg-agent.ts" showLineNumbers copy
import 'dotenv/config';

import { mastra } from './mastra';

const threadId = '123';
const resourceId = 'user-456';

const agent = mastra.getAgent('pgAgent');

const message = await agent.stream('私の名前はMastraです', {
  memory: {
    thread: threadId,
    resource: resourceId,
  },
});

await message.textStream.pipeTo(new WritableStream());

const stream = await agent.stream("私の名前は何？", {
  memory: {
    thread: threadId,
    resource: resourceId,
  },
  memoryOptions: {
    lastMessages: 5,
    semanticRecall: {
      topK: 3,
      messageRange: 2,
    },
  },
});

for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```
