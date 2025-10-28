---
title: "LibSQL を使ったメモリ"
description: Mastra のメモリシステムを、LibSQL のストレージとベクター データベースのバックエンドで使用する方法の例。
---

# LibSQL を使ったメモリ \{#memory-with-libsql\}

この例では、Mastra のメモリシステムを LibSQL をストレージバックエンドとして利用して使う方法を示します。

## 前提条件 \{#prerequisites\}

この例では `openai` モデルを使用します。`.env` ファイルに `OPENAI_API_KEY` を追加してください。

```bash filename=".env" copy
OPENAI_API_KEY=<your-api-key>
```

次のパッケージをインストールしてください：

```bash copy
npm install @mastra/libsql
```

## エージェントにメモリを追加する \{#adding-memory-to-an-agent\}

エージェントに LibSQL のメモリを追加するには、`Memory` クラスを使用し、`LibSQLStore` で新しい `storage` キーを作成します。`url` はリモートのロケーションでもローカルのファイルシステムリソースでも利用できます。

```typescript filename="src/mastra/agents/example-libsql-agent.ts" showLineNumbers copy
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { LibSQLStore } from '@mastra/libsql';

export const libsqlAgent = new Agent({
  name: 'libsql-agent',
  instructions: 'あなたは過去のやり取りの記憶を自動的に呼び出せるAIエージェントです。',
  model: openai('gpt-4o'),
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:libsql-agent.db',
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

埋め込みは、memory の `semanticRecall` が意味（キーワードではなく）に基づいて関連メッセージを取得するために用いる数値ベクトルです。このセットアップでは、`@mastra/fastembed` を使ってベクトル埋め込みを生成します。

まずは `fastembed` をインストールします:

```bash copy
npm install @mastra/fastembed
```

エージェントに次を追加してください：

```typescript filename="src/mastra/agents/example-libsql-agent.ts" showLineNumbers copy
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { fastembed } from '@mastra/fastembed';

export const libsqlAgent = new Agent({
  name: 'libsql-agent',
  instructions: '過去のやり取りの記憶を自動的に想起できるAIエージェントです。',
  model: openai('gpt-4o'),
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:libsql-agent.db',
    }),
    vector: new LibSQLVector({
      connectionUrl: 'file:libsql-agent.db',
    }),
    embedder: fastembed,
    options: {
      lastMessages: 10,
      semanticRecall: {
        topK: 3,
        messageRange: 2,
      },
      threads: {
        generateTitle: true,
      },
    },
  }),
});
```

## 使用例 \{#usage-example\}

このリクエストでのリコール範囲を制御するには `memoryOptions` を使用します。新規性ベースのリコールを絞るために `lastMessages: 5` を設定し、`semanticRecall` を使って、各マッチの前後関係として `messageRange: 2` の隣接メッセージを含めつつ、最も関連性の高いメッセージを `topK: 3` 件取得します。

```typescript filename="src/test-libsql-agent.ts" showLineNumbers copy
import 'dotenv/config';

import { mastra } from './mastra';

const threadId = '123';
const resourceId = 'user-456';

const agent = mastra.getAgent('libsqlAgent');

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

## 関連項目 \{#related\}

* [エージェントの呼び出し](../agents/calling-agents)