---
title: "スレッドとリソース"
description: "Mastra のメモリシステムが、ワーキングメモリ、会話履歴、セマンティックリコールを用いてどのように機能するかを学びましょう。"
sidebar_position: 2
---

# メモリのスレッドとリソース \{#memory-threads-and-resources\}

Mastra はメモリをスレッドとして整理します。スレッドは関連するやり取りをまとめる記録で、次の2つの識別子を使用します。

1. **`thread`**: 会話を表すグローバル一意のID（例: `support_123`）。すべてのリソース間で一意である必要があります。
2. **`resource`**: スレッドの所有者であるユーザーまたはエンティティ（例: `user_123`, `org_456`）。

`resource` は特に[リソーススコープのメモリ](./working-memory#resource-scoped-memory)において重要で、同じユーザーまたはエンティティに関連付けられたすべてのスレッド間でメモリを保持できます。

```typescript {4} showLineNumbers
const stream = await agent.stream('エージェントへのメッセージ', {
  memory: {
    thread: 'user-123',
    resource: 'test-123',
  },
});
```

:::warning

メモリを設定していても、`thread` と `resource` の両方が指定されていない限り、エージェントは情報を保存・参照しません。

:::

> Mastra Playground では `thread` と `resource` の ID が自動で設定されます。独自のアプリケーションでは、各 `.generate()` または `.stream()` の呼び出しごとに手動で指定する必要があります。

### スレッドタイトルの生成 \{#thread-title-generation\}

Mastra は、ユーザーの最初のメッセージに基づいてわかりやすいスレッドタイトルを自動生成できます。これを有効にするには、`generateTitle` を `true` に設定します。これにより整理がしやすくなり、UI で会話を表示しやすくなります。

```typescript {3-7} showLineNumbers
export const testAgent = new Agent({
  memory: new Memory({
    options: {
      threads: {
        generateTitle: true,
      },
    },
  }),
});
```

> タイトル生成はエージェントの応答後に非同期で行われ、応答時間には影響しません。詳細と例は[完全な構成リファレンス](/docs/reference/memory)をご覧ください。

#### タイトル生成の最適化 \{#optimizing-title-generation\}

タイトルはデフォルトでエージェントのモデルによって生成されます。コストや挙動を最適化するには、より小さい`model`とカスタムの`instructions`を指定します。これにより、タイトル生成をメインの会話ロジックから切り離せます。

```typescript {5-9} showLineNumbers
export const testAgent = new Agent({
  // ...
  memory: new Memory({
    options: {
      threads: {
        generateTitle: {
          model: openai('gpt-4.1-nano'),
          instructions: "ユーザーの最初のメッセージに基づいて簡潔なタイトルを生成してください",
        },
      },
    },
  }),
});
```

#### 動的なモデル選択とインストラクション \{#dynamic-model-selection-and-instructions\}

`model` と `instructions` に関数を渡すことで、スレッドタイトルの生成を動的に設定できます。これらの関数は `runtimeContext` オブジェクトを受け取り、ユーザー固有の値に応じてタイトル生成を調整できます。

```typescript {7-16} showLineNumbers
export const testAgent = new Agent({
  // ...
  memory: new Memory({
    options: {
      threads: {
        generateTitle: {
          model: ({ runtimeContext }) => {
            const userTier = runtimeContext.get('userTier');
            return userTier === 'premium' ? openai('gpt-4.1') : openai('gpt-4.1-nano');
          },
          instructions: ({ runtimeContext }) => {
            const language = runtimeContext.get('userLanguage') || 'English';
            return `ユーザーの最初のメッセージに基づいて、${language}で簡潔で魅力的なタイトルを生成してください。`;
          },
        },
      },
    },
  }),
});
```
