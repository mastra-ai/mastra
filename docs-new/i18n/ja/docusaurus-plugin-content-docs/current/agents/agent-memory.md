---
title: "メモリー"
description: Mastra のエージェントが会話履歴やコンテキスト情報を保存するためにメモリーをどのように活用するかを解説するドキュメント。
sidebar_position: 3
---

# エージェントのメモリ \{#agent-memory\}

Mastra のエージェントは強力なメモリシステムを活用し、会話履歴の保存、関連情報の想起、やり取りをまたいだコンテキストの永続的な維持が可能です。これにより、エージェントはより自然で状態を保った会話を行えます。

## エージェントでメモリを有効にする \{#enabling-memory-for-an-agent\}

メモリを有効化するには、`Memory` クラスをインスタンス化し、`memory` パラメータでエージェントの設定に渡します。あわせて、メモリ用パッケージとストレージアダプターをインストールする必要があります。

```bash npm2yarn copy
npm install @mastra/memory@latest @mastra/libsql@latest
```

```typescript {2-3,10-14} showLineNumbers
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { openai } from '@ai-sdk/openai';

export const testAgent = new Agent({
  name: 'test-agent',
  instructions: 'あなたは記憶機能を持つ親切なアシスタントです。',
  model: openai('gpt-4o'),
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../../memory.db',
    }),
  }),
});
```

この基本セットアップはデフォルト設定を使用します。設定の詳細については、[Memory のドキュメント](../memory/overview)をご覧ください。

## エージェント呼び出しにおけるメモリ \{#memory-in-agent-calls\}

`.generate()` または `.stream()` を呼び出す際、メモリを有効にするには、`resource` と `thread` の両方を持つ `memory` オブジェクトを指定してください。

* `resource`: ユーザーまたはエンティティを一意に示す安定した識別子。
* `thread`: 特定の会話やセッションを区切るための ID。

これらのフィールドは、コンテキストの保存先と取得元をエージェントに示し、やり取りをまたいで持続するスレッド対応のメモリを実現します。

```typescript {3-4}
const response = await testAgent.generate('私の好きな色は青だということを覚えておいてください。', {
  memory: {
    resource: 'user_alice',
    thread: 'preferences_thread',
  },
});
```

メモリに保存された情報を再取得するには、元のやり取りで使用したのと同じ `resource` と `thread` の値でエージェントを呼び出します。

```typescript {3-4}
const response = await testAgent.generate("私の好きな色は何ですか?", {
  memory: {
    resource: 'user_alice',
    thread: 'preferences_thread',
  },
});
```

## `RuntimeContext` を使ったメモリ \{#memory-with-runtimecontext\}

`instructions`、`models`、`tools` と同様に、[RuntimeContext](/docs/server-db/runtime-context) を使ってメモリを動的に設定できます。これにより、メモリの挙動をきめ細かく制御できます。たとえば、ユーザーごとに異なるメモリシステムを選択したり、条件に応じて機能を有効化したり、環境に合わせて設定を調整したりできます。

### エージェントの設定 \{#agent-configuration\}

```typescript {18-20} filename="src/mastra/agents/test-agent.ts" showLineNumbers copy
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { openai } from '@ai-sdk/openai';

const premiumMemory = new Memory({
  // ...
});

const standardMemory = new Memory({
  // ...
});

export const testAgent = new Agent({
  name: 'test-agent',
  instructions: 'あなたは段階的なメモリ機能を持つ親切なアシスタントです。',
  model: openai('gpt-4o'),
  memory: ({ runtimeContext }) => {
    const userTier = runtimeContext.get('userTier');
    return userTier === 'premium' ? premiumMemory : standardMemory;
  },
});
```

### エージェントの使用 \{#agent-usage\}

実行時に条件分岐を可能にするには、設定済みの `RuntimeContext` インスタンスをエージェントに渡します。これにより、エージェントは実行時の値に基づいて挙動を適応させられます。

```typescript {1,4,6, 13} showLineNumbers copy
import { RuntimeContext } from '@mastra/core/runtime-context';

const testAgent = mastra.getAgent('testAgent');
const runtimeContext = new RuntimeContext();

runtimeContext.set('userTier', 'premium');

const response = await testAgent.generate('私の好きな色は青です。覚えておいてください。', {
  memory: {
    resource: 'user_alice',
    thread: { id: 'preferences_thread' },
  },
  runtimeContext,
});
```

## 非同期メモリの設定 \{#async-memory-configuration\}

メモリは非同期に構成でき、データベースからユーザー固有の設定を取得したり、Auth でアクセスを検証したり、リモートサービスから追加データを読み込むなどのユースケースに対応します。

```typescript {18, 22} filename="src/mastra/agents/test-agent.ts" showLineNumbers copy
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { openai } from '@ai-sdk/openai';

const premiumMemory = new Memory({
  // ...
});

const standardMemory = new Memory({
  // ...
});

export const testAgent = new Agent({
  name: 'test-agent',
  instructions: 'メモリ機能が階層化された便利なアシスタントです。',
  model: openai('gpt-4o'),
  memory: async ({ runtimeContext }) => {
    const userId = runtimeContext.get('userId');

    // `userId`を使用したデータベース検索の例
    const userTier = await query(`SELECT user_tier FROM users WHERE userId = $1`, [userId]);

    return userTier === 'premium' ? premiumMemory : standardMemory;
  },
});
```

## 関連 \{#related\}

* [作業記憶](../memory/working-memory)
* [意味記憶の想起](../memory/semantic-recall)
* [スレッドとリソース](../memory/threads-and-resources)