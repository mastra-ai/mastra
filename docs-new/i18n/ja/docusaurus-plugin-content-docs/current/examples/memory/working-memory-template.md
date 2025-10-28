---
title: "テンプレート付きワーキングメモリ"
description: Markdown テンプレートでワーキングメモリのデータを構造化する方法を示す例。
---

# テンプレートを用いたワーキングメモリ \{#working-memory-with-template\}

テンプレートを使って、ワーキングメモリに保存する情報の構造を定義します。テンプレートは、エージェントが会話をまたいで一貫した構造化データを抽出・保持するのに役立ちます。

これは、`.stream()` によるストリーミング応答と、`.generate()` による生成応答の両方で機能し、セッション間でデータを保持するために PostgreSQL、LibSQL、Redis などのストレージプロバイダが必要です。

この例では、ワーキングメモリのテンプレートを使って ToDo リストを管理する方法を示します。

## 前提条件 \{#prerequisites\}

この例では `openai` モデルを使用します。`.env` ファイルに `OPENAI_API_KEY` を追加してください。

```bash filename=".env" copy
OPENAI_API_KEY=<your-api-key>
```

次のパッケージをインストールします：

```bash copy
npm install @mastra/libsql
```

## エージェントにメモリを追加する \{#adding-memory-to-an-agent\}

エージェントに LibSQL のメモリを追加するには、`Memory` クラスを使用し、`LibSQLStore` を用いて `storage` インスタンスを渡します。`url` はリモートの場所またはローカルファイルを指せます。

### `template` を用いたワーキングメモリ \{#working-memory-with-template\}

`workingMemory.enabled` を `true` に設定してワーキングメモリを有効にします。これにより、エージェントはやり取りの間で構造化された情報を保持できるようになります。

`template` を指定すると、記憶すべき内容の構造を定義できます。この例では、テンプレートは Markdown の書式を使って、タスクを進行中と完了済みの項目に整理します。

スレッドは関連するメッセージを会話としてまとめます。`generateTitle` を有効にすると、各スレッドには内容に基づく説明的な名前が自動で付けられます。

```typescript filename="src/mastra/agents/example-working-memory-template-agent.ts" showLineNumbers copy
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { LibSQLStore } from '@mastra/libsql';

export const workingMemoryTemplateAgent = new Agent({
  name: 'ワーキングメモリ・テンプレート・エージェント',
  instructions: `
    あなたはToDoリスト用のAIエージェントです。
    会話を開始するときは、必ず現在のリストを表示してください。
    各タスクには、番号付きのタイトル、期限、説明、ステータス、見積もり時間を含めてください。
    各項目には絵文字を使用してください。
    サブタスクは箇条書きで表現してください。
    タイムボクシングのため、所要時間の見積もりを尋ねてください。
  `,
  model: openai('gpt-4o'),
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:working-memory-template.db',
    }),
    options: {
      workingMemory: {
        enabled: true,
        template: `
          # ToDoリスト
          ## 進行中の項目
          - タスク1: サンプルタスク
            - 期限: 2028年2月7日
            - 説明: これはサンプルタスクです
            - ステータス: 未着手
            - 見積もり時間: 2時間

          ## 完了済みの項目
          - まだありません
      },
      threads: {
        generateTitle: true,
      },
    },
  }),
});
```

## 使用例 \{#usage-examples\}

この例では、ワーキングメモリのテンプレートを用いて構造化情報を管理するエージェントとのやり取り方法を示します。エージェントは同一スレッド内の複数回の対話にわたって、ToDoリストを更新し、保持します。

### `.stream()` を使ってレスポンスをストリーミングする \{#streaming-a-response-using-stream\}

この例では、新しいタスクを伴うメッセージをエージェントに送信します。レスポンスはストリーミングされ、更新されたToDoリストが含まれます。

```typescript filename="src/test-working-memory-template-agent.ts" showLineNumbers copy
import 'dotenv/config';

import { mastra } from './mastra';

const threadId = '123';
const resourceId = 'user-456';

const agent = mastra.getAgent('workingMemoryTemplateAgent');

const stream = await agent.stream(
  'タスクを追加: アプリの新機能を構築する。所要時間は約2時間で、来週の金曜日までに完了する必要がある。',
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

### `.generate()` を使って応答を生成する \{#generating-a-response-using-generate\}

この例では、新しいタスクを含むメッセージをエージェントに送信します。応答は1件のメッセージとして返され、更新されたToDoリストが含まれます。

```typescript filename="src/test-working-memory-template-agent.ts" showLineNumbers copy
import 'dotenv/config';

import { mastra } from './mastra';

const threadId = '123';
const resourceId = 'user-456';

const agent = mastra.getAgent('workingMemoryTemplateAgent');

const response = await agent.generate(
  'タスクを追加: アプリの新機能を構築する。所要時間は約2時間で、来週の金曜日までに完了する必要がある。',
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

この出力は、作業用メモリのテンプレートで定義された構造に従って、エージェントが更新済みのToDoリストをどのように整形して返すかを示しています。

```text
# Todoリスト
## 進行中の項目
1. 🛠️ **タスク:** アプリの新機能を構築する
   - 📅 **期限:** 来週の金曜日
   - 📝 **説明:** 既存のアプリケーションに新機能を開発して統合する。
   - ⏳ **ステータス:** 未着手
   - ⏲️ **推定時間:** 2時間

## 完了した項目
- まだありません
```

## ストレージオブジェクトの例 \{#example-storage-object\}

Working memory はデータを `.json` 形式で保存します。次のようになります。

```json
{
  // ...
  "toolInvocations": [
    {
      // ...
      "args": {
        "memory": "# Todoリスト\n## 進行中の項目\n- タスク1: アプリの新機能を構築する\n  - 期限: 来週の金曜日\n  - 説明: アプリの新機能を構築する\n  - ステータス: 未着手\n  - 見積もり時間: 2時間\n\n## 完了した項目\n- まだなし"
      }
    }
  ]
}
```

## 関連 \{#related\}

* [エージェントの呼び出し](../agents/calling-agents#from-the-command-line)
* [エージェントメモリ](/docs/agents/agent-memory)
* [LibSQL ストレージ](/docs/reference/storage/libsql)