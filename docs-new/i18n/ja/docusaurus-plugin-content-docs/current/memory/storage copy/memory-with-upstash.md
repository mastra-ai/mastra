---
title: Upstash を用いたメモリ
description: Mastra のメモリシステムを、Upstash Redis のストレージとベクトル機能で活用する方法の例。
---

# Upstash を使ったメモリ \{#memory-with-upstash\}

この例では、Mastra のメモリシステムで Upstash をストレージのバックエンドとして利用する方法を示します。

## 前提条件 \{#prerequisites\}

この例では `openai` モデルを使用し、Upstash Redis と Upstash Vector の両方のサービスが必要です。`.env` ファイルに次を追加してください：

```bash title=".env" copy
OPENAI_API_KEY=<API キー>
UPSTASH_REDIS_REST_URL=<Redis の URL>
UPSTASH_REDIS_REST_TOKEN=<Redis のトークン>
UPSTASH_VECTOR_REST_URL=<ベクターインデックスの URL>
UPSTASH_VECTOR_REST_TOKEN=<ベクターインデックスのトークン>
```

[upstash.com](https://upstash.com) に登録し、Redis と Vector の両方のデータベースを作成すると、Upstash の認証情報を取得できます。

次のパッケージをインストールしてください:

```bash copy
npm install @mastra/upstash
```

## エージェントにメモリを追加する \{#adding-memory-to-an-agent\}

エージェントに Upstash のメモリを追加するには、`Memory` クラスを使用し、`UpstashStore` で新しい `storage` キーを、`UpstashVector` で新しい `vector` キーを作成します。設定はリモートサービスにもローカル環境にも向けられます。

```typescript title="src/mastra/agents/example-upstash-agent.ts" showLineNumbers copy
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { UpstashStore } from '@mastra/upstash';

export const upstashAgent = new Agent({
  name: 'upstash-agent',
  instructions: 'あなたは過去のやり取りの記憶を自動的に想起できるAIエージェントです。',
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

埋め込みは、メモリーの `semanticRecall` が意味（キーワードではなく）に基づいて関連メッセージを取得するために使う数値ベクトルです。このセットアップでは、`@mastra/fastembed` を用いてベクトル埋め込みを生成します。

まずは `fastembed` をインストールします:

```bash copy
npm install @mastra/fastembed
```

エージェントに次の内容を追加してください：

```typescript title="src/mastra/agents/example-upstash-agent.ts" showLineNumbers copy
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { UpstashStore, UpstashVector } from '@mastra/upstash';
import { fastembed } from '@mastra/fastembed';

export const upstashAgent = new Agent({
  name: 'upstash-agent',
  instructions: 'あなたは過去のやり取りを自動的に参照・想起できるAIエージェントです。',
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

このリクエストでのリコール範囲を指定するには `memoryOptions` を使用します。`lastMessages: 5` を設定して直近メッセージに基づくリコールを制限し、`semanticRecall` を使って、各一致の前後の文脈として `messageRange: 2` の隣接メッセージを含む、関連度の高いメッセージを `topK: 3` 件取得します。

```typescript title="src/test-upstash-agent.ts" showLineNumbers copy
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

const stream = await agent.stream("私の名前は何ですか？", {
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

* [エージェントの呼び出し](/docs/examples/agents/calling-agents)