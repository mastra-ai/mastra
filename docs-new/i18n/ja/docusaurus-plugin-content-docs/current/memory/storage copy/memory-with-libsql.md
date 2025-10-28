---
title: LibSQL を使ったメモリ
description: Mastra のメモリシステムを、LibSQL ストレージとベクターデータベースのバックエンドで利用する方法の例。
sidebar_position: 1
---

# LibSQL を使ったメモリ \{#memory-with-libsql\}

この例では、Mastra のメモリシステムで LibSQL をストレージバックエンドとして使用する方法を紹介します。

## 前提条件 \{#prerequisites\}

この例では `openai` モデルを使用します。`.env` ファイルに `OPENAI_API_KEY` を追加してください。

```bash title=".env" copy
OPENAI_API_KEY=<your-api-key>
```

次のパッケージをインストールします。

```bash copy
npm install @mastra/libsql
```

## エージェントにメモリを追加する \{#adding-memory-to-an-agent\}

エージェントに LibSQL のメモリを追加するには、`Memory` クラスを使用し、`LibSQLStore` で新しい `storage` キーを作成します。`url` にはリモートのロケーションまたはローカルのファイルシステムのリソースを指定できます。

```typescript title="src/mastra/agents/example-libsql-agent.ts" showLineNumbers copy
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { LibSQLStore } from '@mastra/libsql';

export const libsqlAgent = new Agent({
  name: 'libsql-agent',
  instructions: 'あなたは過去のやり取りから自動的に記憶を呼び出すことができるAIエージェントです。',
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

埋め込みは、memory の `semanticRecall` が意味（キーワードではなく）に基づいて関連メッセージを取得するために使う数値ベクトルです。このセットアップでは、ベクトル埋め込みを生成するために `@mastra/fastembed` を使用します。

まずは `fastembed` をインストールします:

```bash copy
npm install @mastra/fastembed
```

エージェントに次の内容を追加してください：

```typescript title="src/mastra/agents/example-libsql-agent.ts" showLineNumbers copy
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { fastembed } from '@mastra/fastembed';

export const libsqlAgent = new Agent({
  name: 'libsql-agent',
  instructions: 'あなたは過去のやり取りから自動的に記憶を呼び出すことができるAIエージェントです。',
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

このリクエストでのリコール範囲を制御するには `memoryOptions` を使用します。`lastMessages: 5` を設定して直近メッセージに基づくリコールを制限し、`semanticRecall` を使って最も関連性の高い `topK: 3` 件のメッセージを取得します。各一致の前後の文脈として、それぞれに隣接する `messageRange: 2` 件のメッセージも含めます。

```typescript title="src/test-libsql-agent.ts" showLineNumbers copy
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

const stream = await agent.stream('私の名前は何ですか?', {
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
