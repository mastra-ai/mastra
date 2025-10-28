---
title: "Memory クラス"
description: "Mastra の `Memory` クラスに関するドキュメント。会話履歴の管理とスレッドベースのメッセージ保存を行う堅牢なシステムを提供します。"
---

# Memory クラス \{#memory-class\}

`Memory` クラスは、Mastra における会話履歴とスレッド型メッセージの保存を管理する堅牢な仕組みを提供します。これにより、会話の永続的な保存、セマンティック検索、効率的なメッセージ取得が可能になります。会話履歴にはストレージプロバイダーの設定が必須で、セマンティックリコールを有効化する場合は、ベクターストアとエンベッダーの指定も必要です。

## 使い方の例 \{#usage-example\}

```typescript filename="src/mastra/agents/test-agent.ts" showLineNumbers copy
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

export const agent = new Agent({
  name: 'test-agent',
  instructions: 'あなたは記憶機能を持つエージェントです。',
  model: openai('gpt-4o'),
  memory: new Memory({
    options: {
      workingMemory: {
        enabled: true,
      },
    },
  }),
});
```

> エージェントで`workingMemory`を有効にするには、メインの Mastra インスタンスにストレージプロバイダーを設定する必要があります。詳細は [Mastra class](../core/mastra-class) を参照してください。

## コンストラクター引数 \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "storage",
type: "MastraStorage",
description: "メモリーデータを永続化するためのストレージ実装。指定しない場合は `new DefaultStorage({ config: { url: \"file:memory.db\" } })` がデフォルトになります。",
isOptional: true,
},
{
name: "vector",
type: "MastraVector | false",
description: "セマンティック検索のためのベクターストア。ベクター機能を無効化するには `false` を指定します。",
isOptional: true,
},
{
name: "embedder",
type: "EmbeddingModel<string> | EmbeddingModelV2<string>",
description: "ベクトル埋め込み用のエンベッダーインスタンス。セマンティックリコールを有効にする場合は必須です。",
isOptional: true,
},
{
name: "options",
type: "MemoryConfig",
description: "メモリー設定オプション。",
isOptional: true,
},
{
name: "processors",
type: "MemoryProcessor[]",
description: "LLM に送信する前にメッセージをフィルタリングまたは変換できるメモリープロセッサの配列。",
isOptional: true,
},
]}
/>

### オプションパラメーター \{#options-parameters\}

<PropertiesTable
  content={[
{
name: "lastMessages",
type: "number | false",
description: "取得する直近メッセージ数。無効にするには false を指定します。",
isOptional: true,
defaultValue: "10",
},
{
name: "semanticRecall",
type: "boolean | { topK: number; messageRange: number | { before: number; after: number }; scope?: 'thread' | 'resource' }",
description: "メッセージ履歴のセマンティック検索を有効化します。boolean のほか、設定オプションを含むオブジェクトも指定できます。有効化には vector store と embedder の両方の設定が必要です。",
isOptional: true,
defaultValue: "false",
},
{
name: "workingMemory",
type: "WorkingMemory",
description: "ワーキングメモリ機能の設定。`{ enabled: boolean; template?: string; schema?: ZodObject<any> | JSONSchema7; scope?: 'thread' | 'resource' }` または `{ enabled: boolean }`（無効化）を指定できます。",
isOptional: true,
defaultValue: "{ enabled: false, template: '# User Information\\n- **First Name**:\\n- **Last Name**:\\n...' }",
},
{
name: "threads",
type: "{ generateTitle?: boolean | { model: DynamicArgument<MastraLanguageModel>; instructions?: DynamicArgument<string> } }",
description: "メモリスレッドの作成に関する設定。`generateTitle` は、ユーザーの最初のメッセージからスレッドタイトルを自動生成するかを制御します。boolean のほか、カスタムの model と instructions を含むオブジェクトも指定できます。",
isOptional: true,
defaultValue: "{ generateTitle: false }",
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "memory",
type: "Memory",
description: "指定の設定で作成された新しい Memory インスタンス。",
},
]}
/>

## 応用例 \{#extended-usage-example\}

```typescript filename="src/mastra/agents/test-agent.ts" showLineNumbers copy
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';

export const agent = new Agent({
  name: 'test-agent',
  instructions: 'あなたは記憶機能を持つエージェントです。',
  model: openai('gpt-4o'),
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:./working-memory.db',
    }),
    vector: new LibSQLVector({
      connectionUrl: 'file:./vector-memory.db',
    }),
    options: {
      lastMessages: 10,
      semanticRecall: {
        topK: 3,
        messageRange: 2,
        scope: 'resource',
      },
      workingMemory: {
        enabled: true,
      },
      threads: {
        generateTitle: true,
      },
    },
  }),
});
```

## インデックス設定付きの PostgreSQL \{#postgresql-with-index-configuration\}

```typescript filename="src/mastra/agents/pg-agent.ts" showLineNumbers copy
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { PgStore, PgVector } from '@mastra/pg';

export const agent = new Agent({
  name: 'pg-agent',
  instructions: '最適化されたPostgreSQLメモリを備えたエージェントです。',
  model: openai('gpt-4o'),
  memory: new Memory({
    storage: new PgStore({
      connectionString: process.env.DATABASE_URL,
    }),
    vector: new PgVector({
      connectionString: process.env.DATABASE_URL,
    }),
    embedder: openai.embedding('text-embedding-3-small'),
    options: {
      lastMessages: 20,
      semanticRecall: {
        topK: 5,
        messageRange: 3,
        scope: 'resource',
        indexConfig: {
          type: 'hnsw', // パフォーマンス向上のためにHNSWを使用します
          metric: 'dotproduct', // OpenAIの埋め込みに最適です
          m: 16, // 双方向リンクの数
          efConstruction: 64, // 構築時の候補リストのサイズ
        },
      },
      workingMemory: {
        enabled: true,
      },
    },
  }),
});
```

### 関連 \{#related\}

* [Memory の概要](/docs/memory/overview)
* [セマンティックリコール](/docs/memory/semantic-recall)
* [ワーキングメモリ](/docs/memory/working-memory)
* [メモリプロセッサ](/docs/memory/memory-processors)
* [createThread](/docs/reference/memory/createThread)
* [query](/docs/reference/memory/query)
* [getThreadById](/docs/reference/memory/getThreadById)
* [getThreadsByResourceId](/docs/reference/memory/getThreadsByResourceId)
* [deleteMessages](/docs/reference/memory/deleteMessages)