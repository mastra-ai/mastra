---
title: "Upstash を使ったメモリ"
description: Mastra のメモリシステムを、Upstash Redis のストレージとベクター機能で活用する方法の例。
---

# Upstash を用いたメモリ \{#memory-with-upstash\}

この例では、Mastra のメモリシステムで Upstash をストレージのバックエンドとして利用する方法を紹介します。

## 前提条件 \{#prerequisites\}

この例では `openai` モデルを使用し、Upstash Redis と Upstash Vector の両方のサービスが必要です。`.env` ファイルに次の内容を追加してください:

```bash filename=".env" copy
OPENAI_API_KEY=<your-api-key>
UPSTASH_REDIS_REST_URL=<your-redis-url>
UPSTASH_REDIS_REST_TOKEN=<your-redis-token>
UPSTASH_VECTOR_REST_URL=<your-vector-index-url>
UPSTASH_VECTOR_REST_TOKEN=<your-vector-index-token>
```

[upstash.com](https://upstash.com) にサインアップし、Redis と Vector の両方のデータベースを作成すると、Upstash のクレデンシャルを取得できます。

次のパッケージをインストールしてください:

```bash copy
npm install @mastra/upstash
```

## エージェントにメモリを追加する \{#adding-memory-to-an-agent\}

エージェントに Upstash のメモリを追加するには、`Memory` クラスを使用し、`UpstashStore` で新しい `storage` キー、`UpstashVector` で新しい `vector` キーを作成します。設定はリモートのサービスにもローカル環境にも向けられます。

```typescript filename="src/mastra/agents/example-upstash-agent.ts" showLineNumbers copy
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { UpstashStore } from '@mastra/upstash';

export const upstashAgent = new Agent({
  name: 'upstash-agent',
  instructions: 'あなたは過去のやり取りから記憶を自動的に呼び出すことができるAIエージェントです。',
  model: openai('gpt-4o'),
  memory: new Memory({
    storage: new UpstashStore({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
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

埋め込みは、memory の `semanticRecall` が意味（キーワードではなく）に基づいて関連メッセージを取得するために用いる数値ベクトルです。このセットアップでは、ベクトル埋め込みを生成するために `@mastra/fastembed` を使用します。

まずは `fastembed` をインストールします:

```bash copy
npm install @mastra/fastembed
```

エージェントに次を追加してください:

```typescript filename="src/mastra/agents/example-upstash-agent.ts" showLineNumbers copy
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { UpstashStore, UpstashVector } from '@mastra/upstash';
import { fastembed } from '@mastra/fastembed';

export const upstashAgent = new Agent({
  name: 'upstash-agent',
  instructions: 'あなたは過去のやり取りから記憶を自動的に呼び出すことができるAIエージェントです。',
  model: openai('gpt-4o'),
  memory: new Memory({
    storage: new UpstashStore({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    }),
    vector: new UpstashVector({
      url: process.env.UPSTASH_VECTOR_REST_URL!,
      token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
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

このリクエストでの参照範囲を制御するには `memoryOptions` を使用します。直近メッセージの参照を `lastMessages: 5` に制限し、`semanticRecall` を使って、各一致の前後関係として `messageRange: 2` の隣接メッセージを含めながら、最も関連性の高い `topK: 3` 件のメッセージを取得します。

```typescript filename="src/test-upstash-agent.ts" showLineNumbers copy
import 'dotenv/config';

import { mastra } from './mastra';

const threadId = '123';
const resourceId = 'user-456';

const agent = mastra.getAgent('upstashAgent');

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