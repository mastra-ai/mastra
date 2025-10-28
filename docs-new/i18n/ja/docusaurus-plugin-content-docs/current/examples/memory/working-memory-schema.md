---
title: "スキーマを用いたワーキングメモリ"
description: Zod スキーマを使って、ワーキングメモリのデータを構造化し検証する方法を示す例。
---

# スキーマを用いたワーキングメモリ \{#working-memory-with-schema\}

ワーキングメモリに保存する情報の構造を定義するために Zod スキーマを使用します。スキーマは、エージェントが会話をまたいで抽出・保存するデータに対して、型安全性とバリデーションを提供します。

これは `.stream()` によるストリーミング応答と `.generate()` による生成応答の両方で機能し、セッション間でデータを保持するために PostgreSQL、LibSQL、Redis などのストレージプロバイダーが必要です。

この例では、ワーキングメモリ用スキーマを使ってタスク管理（ToDo リスト）を行う方法を示します。

## 前提条件 \{#prerequisites\}

この例では `openai` モデルを使用します。`.env` ファイルに `OPENAI_API_KEY` を追加してください。

```bash filename=".env" copy
OPENAI_API_KEY=<あなたのAPIキー>
```

次のパッケージをインストールします：

```bash copy
npm install @mastra/libsql
```

## エージェントにメモリを追加する \{#adding-memory-to-an-agent\}

エージェントに LibSQL のメモリを追加するには、`Memory` クラスを使用し、`LibSQLStore` を用いて `storage` インスタンスを渡します。`url` はリモートのエンドポイントまたはローカルファイルを指すことができます。

### `schema` を使ったワーキングメモリ \{#working-memory-with-schema\}

`workingMemory.enabled` を `true` に設定してワーキングメモリを有効にします。これにより、エージェントはやり取りの間で構造化された情報を記憶できます。

`schema` を指定すると、エージェントがどのような形で情報を記憶すべきかを定義できます。次の例では、タスクをアクティブと完了のリストに分けています。

スレッドは関連するメッセージを会話としてまとめます。`generateTitle` が有効な場合、各スレッドには内容に基づく説明的な名前が自動的に付けられます。

```typescript filename="src/mastra/agents/example-working-memory-schema-agent.ts" showLineNumbers copy
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';

export const workingMemorySchemaAgent = new Agent({
  name: 'working-memory-schema-agent',
  instructions: `
    あなたはToDoリストのAIエージェントです。
    会話を開始するときは、必ず現在のリストを表示してください。
    各タスクには、インデックス番号付きのタイトル、期限、説明、ステータス、見積もり時間を含めてください。
    各項目には絵文字を使用してください。
    サブタスクには箇条書きを使用して対応してください。
    タイムボクシングのために所要時間の見積もりを尋ねてください。
  `,
  model: openai('gpt-4o'),
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:working-memory-schema.db',
    }),
    options: {
      workingMemory: {
        enabled: true,
        schema: z.object({
          items: z.array(
            z.object({
              title: z.string(),
              due: z.string().optional(),
              description: z.string(),
              status: z.enum(['active', 'completed']).default('active'),
              estimatedTime: z.string().optional(),
            }),
          ),
        }),
      },
      threads: {
        generateTitle: true,
      },
    },
  }),
});
```

## 使用例 \{#usage-examples\}

この例では、構造化データを管理するためのワーキングメモリスキーマを用いるエージェントとのやり取り方法を示します。エージェントは同一スレッド内での複数回の対話にわたり、ToDo リストを更新し、永続化します。

### `.stream()` を使ったレスポンスのストリーミング \{#streaming-a-response-using-stream\}

この例では、新しいタスクを指定してエージェントにメッセージを送信します。レスポンスはストリーミングされ、更新済みの ToDo リストが含まれます。

```typescript filename="src/test-working-memory-schema-agent.ts" showLineNumbers copy
import 'dotenv/config';

import { mastra } from './mastra';

const threadId = '123';
const resourceId = 'user-456';

const agent = mastra.getAgent('workingMemorySchemaAgent');

const stream = await agent.stream(
  'タスクを追加：当社のアプリに新機能を実装してください。所要時間は約2時間で、締切は来週の金曜日です。',
  {
    memory: {
      thread: threadId,
      resource: resourceId,
    },
  },
);

for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

### `.generate()` を使ってレスポンスを生成する \{#generating-a-response-using-generate\}

この例では、新しいタスクを含むメッセージをエージェントに送信します。レスポンスは1つのメッセージとして返され、更新されたToDoリストが含まれます。

```typescript filename="src/test-working-memory-schema-agent.ts" showLineNumbers copy
import 'dotenv/config';

import { mastra } from './mastra';

const threadId = '123';
const resourceId = 'user-456';

const agent = mastra.getAgent('workingMemorySchemaAgent');

const response = await agent.generate(
  'タスクを追加: 当社のアプリに新機能を実装してください。所要時間は約2時間で、期限は次の金曜日です。',
  {
    memory: {
      thread: threadId,
      resource: resourceId,
    },
  },
);

console.log(response.text);
```

## 出力例 \{#example-output\}

この出力は、エージェントが zod スキーマで定義された構造に従って更新後の ToDo リストを整形し、返す方法を示しています。

```text
# やることリスト
## アクティブな項目
1. 🛠️ **タスク:** アプリの新機能を実装する
   - 📅 **期限:** 来週の金曜日
   - 📝 **説明:** 既存のアプリケーションに新機能を開発して統合する。
   - ⏳ **ステータス:** 未着手
   - ⏲️ **見積時間:** 2時間

## 完了した項目
- まだありません
```

## ストレージオブジェクトの例 \{#example-storage-object\}

ワーキングメモリはデータを `.json` 形式で保存します。以下のようになります。

```json
{
  // ...
  "toolInvocations": [
    {
      // ...
      "args": {
        "memory": {
          "items": [
            {
              "title": "当社アプリの新機能を開発する",
              "due": "次の金曜日",
              "description": "",
              "status": "進行中",
              "estimatedTime": "2時間"
            }
          ]
        }
      }
    }
  ]
}
```

## 関連項目 \{#related\}

* [エージェントの呼び出し](../agents/calling-agents#from-the-command-line)
* [エージェントのメモリ](/docs/agents/agent-memory)
* [LibSQL ストレージ](/docs/reference/storage/libsql)