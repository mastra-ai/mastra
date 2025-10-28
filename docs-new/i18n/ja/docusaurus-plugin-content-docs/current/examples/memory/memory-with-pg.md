---
title: "PostgreSQL を使ったメモリ"
description: Mastra のメモリシステムを、PostgreSQL のストレージとベクター機能で利用する方法の例。
---

# PostgreSQL のメモリ活用 \{#memory-with-postgres\}

この例では、Mastra のメモリシステムでストレージのバックエンドとして PostgreSQL を使用する方法を示します。

## 前提条件 \{#prerequisites\}

この例では `openai` モデルを使用し、`pgvector` 拡張機能入りの PostgreSQL データベースが必要です。.env ファイルに次の設定を追加してください:

```bash filename=".env" copy
OPENAI_API_KEY=<your-api-key>
DATABASE_URL=<your-connection-string>
```

次のパッケージをインストールします：

```bash copy
npm install @mastra/pg
```

## エージェントにメモリを追加する \{#adding-memory-to-an-agent\}

エージェントに PostgreSQL のメモリを追加するには、`Memory` クラスを使用し、`PostgresStore` を使って新しい `storage` キーを作成します。`connectionString` には、リモートの接続先またはローカルのデータベース接続を指定できます。

```typescript filename="src/mastra/agents/example-pg-agent.ts" showLineNumbers copy
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { PostgresStore } from '@mastra/pg';

export const pgAgent = new Agent({
  name: 'pg-agent',
  instructions: '過去のやり取りから自動的に記憶を呼び出すことができるAIエージェントです。',
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

埋め込みは、memory の `semanticRecall` が（キーワードではなく）意味に基づいて関連メッセージを検索するために用いる数値ベクトルです。このセットアップでは、ベクトル埋め込みの生成に `@mastra/fastembed` を使用します。

まずは `fastembed` をインストールします:

```bash copy
npm install @mastra/fastembed
```

次の内容をエージェントに追加してください:

```typescript filename="src/mastra/agents/example-pg-agent.ts" showLineNumbers copy
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { PostgresStore, PgVector } from '@mastra/pg';
import { fastembed } from '@mastra/fastembed';

export const pgAgent = new Agent({
  name: 'pg-agent',
  instructions: '過去のやり取りから記憶を自動的に呼び出すことができるAIエージェントです。',
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

このリクエストでの参照範囲を制御するには `memoryOptions` を使用します。`lastMessages: 5` を設定して直近ベースの参照を絞り込み、`semanticRecall` を使って最も関連性の高い `topK: 3` 件のメッセージを取得します。さらに、各一致の前後関係として `messageRange: 2` 件の隣接メッセージを含めます。

```typescript filename="src/test-pg-agent.ts" showLineNumbers copy
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

const stream = await agent.stream("私の名前は何ですか?", {
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

## 関連項目 \{#related\}

* [エージェントの呼び出し](../agents/calling-agents)