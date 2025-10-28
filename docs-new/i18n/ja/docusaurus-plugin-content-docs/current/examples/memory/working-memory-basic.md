---
title: "基本的なワーキングメモリ"
description: エージェントが会話の文脈を維持できるように、基本的なワーキングメモリを有効化する方法の例。
---

# 基本的なワーキングメモリ \{#basic-working-memory\}

ワーキングメモリを使うと、エージェントが重要な事実を覚え、ユーザー情報を追跡し、会話全体のコンテキストを保てるようになります。

ワーキングメモリは、`.stream()` を使ったストリーミング応答と、`.generate()` を使った生成応答の両方で機能し、セッション間でデータを保持するために PostgreSQL、LibSQL、Redis などのストレージプロバイダーが必要です。

この例では、エージェントでワーキングメモリを有効化し、同じスレッド内の複数メッセージにわたってやり取りする方法を示します。

## 前提条件 \{#prerequisites\}

この例では `openai` モデルを使用します。`.env` ファイルに `OPENAI_API_KEY` を追加してください。

```bash filename=".env" copy
OPENAI_API_KEY=<あなたのAPIキー>
```

次のパッケージをインストールしてください：

```bash copy
npm install @mastra/libsql
```

## エージェントにメモリを追加する \{#adding-memory-to-an-agent\}

エージェントに LibSQL のメモリを追加するには、`Memory` クラスを使用し、`LibSQLStore` を用いて `storage` インスタンスを渡します。`url` はリモートの場所またはローカルファイルを指すことができます。

### ワーキングメモリの設定 \{#working-memory-configuration\}

`workingMemory.enabled` を `true` に設定してワーキングメモリを有効にします。これにより、エージェントは過去の会話の情報を保持し、セッション間で構造化データを持続的に保存できます。

スレッドは、関連するメッセージをまとめて個別の会話として扱います。`generateTitle` が有効な場合、各スレッドは内容に基づいて自動的に命名されます。

```typescript filename="src/mastra/agents/example-working-memory-agent.ts" showLineNumbers copy
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { LibSQLStore } from '@mastra/libsql';

export const workingMemoryAgent = new Agent({
  name: 'working-memory-agent',
  instructions: 'あなたは過去のやり取りの記憶を自動的に呼び出せるAIエージェントです。',
  model: openai('gpt-4o'),
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:working-memory.db',
    }),
    options: {
      workingMemory: {
        enabled: true,
      },
      generateTitle: true, // タイトルの自動生成を明示的に有効化
    },
  }),
});
```

## 使用例 \{#usage-examples\}

この例では、ワーキングメモリを有効にしたエージェントとのやり取り方法を示します。エージェントは、同じスレッド内の複数のインタラクションで共有された情報を記憶します。

### `.stream()` を使ったレスポンスのストリーミング \{#streaming-a-response-using-stream\}

この例では、同じスレッド内でエージェントに 2 件のメッセージを送信します。レスポンスはストリーミングされ、最初のメッセージで記憶された情報が含まれます。

```typescript filename="src/test-working-memory-agent.ts" showLineNumbers copy
import 'dotenv/config';

import { mastra } from './mastra';

const threadId = '123';
const resourceId = 'user-456';

const agent = mastra.getAgent('workingMemoryAgent');

await agent.stream('私の名前はMastraです', {
  memory: {
    thread: threadId,
    resource: resourceId,
  },
});

const stream = await agent.stream('私について何か知っていますか?', {
  memory: {
    thread: threadId,
    resource: resourceId,
  },
});

for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

### `.generate()` を使って応答を生成する \{#generating-a-response-using-generate\}

この例では、同じスレッド内でエージェントに 2 件のメッセージを送信します。応答は 1 件のメッセージとして返され、最初のメッセージの内容が記憶されて反映されます。

```typescript filename="src/test-working-memory-agent.ts" showLineNumbers copy
import 'dotenv/config';

import { mastra } from './mastra';

const threadId = '123';
const resourceId = 'user-456';

const agent = mastra.getAgent('workingMemoryAgent');

await agent.generate('私の名前はMastraです', {
  memory: {
    thread: threadId,
    resource: resourceId,
  },
});

const response = await agent.generate('私のことについて何を知っていますか？', {
  memory: {
    thread: threadId,
    resource: resourceId,
  },
});

console.log(response.text);
```

## 出力例 \{#example-output\}

この出力は、エージェントが記憶を用いて情報を思い出したことを示しています。

```text
あなたの下のお名前がMastraだと存じています。
ほかに共有したいことや更新したいことがあれば、どうぞ遠慮なくお知らせください！
```

## ストレージオブジェクトの例 \{#example-storage-object\}

Working memory はデータを `.json` 形式で保存し、次のようになります。

```json
{
  // ...
  "toolInvocations": [
    {
      // ...
      "args": {
        "memory": "# ユーザー情報\n- **名前**: Mastra\n-"
      }
    }
  ]
}
```

## 関連項目 \{#related\}

* [エージェントの呼び出し](../agents/calling-agents#from-the-command-line)
* [エージェントのメモリ](/docs/agents/agent-memory)
* [LibSQL ストレージ](/docs/reference/storage/libsql)