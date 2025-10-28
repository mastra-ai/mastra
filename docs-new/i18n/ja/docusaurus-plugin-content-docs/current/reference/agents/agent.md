---
title: "Agent クラス"
description: "Mastra の `Agent` クラスに関するドキュメント。多様な機能を備えた AI エージェントを作成するための基盤を提供します。"
---

# Agent クラス \{#agent-class\}

`Agent` クラスは、Mastra で AI エージェントを作成するための中核となる基盤です。応答生成、やり取りのストリーミング、音声機能の処理といった機能のためのメソッドを提供します。

## 使い方の例 \{#usage-examples\}

### 文字列に関する基本的な指示 \{#basic-string-instructions\}

```typescript filename="src/mastra/agents/string-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

// 文字列による指示
export const agent = new Agent({
  name: 'test-agent',
  instructions: '簡潔な回答を提供する親切なアシスタントです。',
  model: openai('gpt-4o'),
});

// システムメッセージオブジェクト
export const agent2 = new Agent({
  name: 'test-agent-2',
  instructions: {
    role: 'system',
    content: '熟練したプログラマーです',
  },
  model: openai('gpt-4o'),
});

// システムメッセージの配列
export const agent3 = new Agent({
  name: 'test-agent-3',
  instructions: [
    { role: 'system', content: '親切なアシスタントです' },
    { role: 'system', content: 'TypeScriptの専門知識を持っています' },
  ],
  model: openai('gpt-4o'),
});
```

### 単一の CoreSystemMessage \{#single-coresystemmessage\}

`providerOptions` などのプロバイダー固有の設定にアクセスするには、CoreSystemMessage フォーマットを使用します。

```typescript filename="src/mastra/agents/core-message-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

export const agent = new Agent({
  name: 'core-message-agent',
  instructions: {
    role: 'system',
    content: 'あなたは技術ドキュメントに特化した有能なアシスタントです。',
    providerOptions: {
      openai: {
        reasoningEffort: 'low',
      },
    },
  },
  model: openai('gpt-5'),
});
```

### 複数の CoreSystemMessage \{#multiple-coresystemmessages\}

```typescript filename="src/mastra/agents/multi-message-agent.ts" showLineNumbers copy
import { anthropic } from '@ai-sdk/anthropic';
import { Agent } from '@mastra/core/agent';

// これはユーザーに合わせてカスタマイズできます
const preferredTone = {
  role: 'system',
  content: '常にプロフェッショナルで共感的なトーンを保ってください。',
};

export const agent = new Agent({
  name: 'multi-message-agent',
  instructions: [
    { role: 'system', content: 'あなたはカスタマーサポート担当者です。' },
    preferredTone,
    {
      role: 'system',
      content: '必要に応じて、複雑な問題は人間の担当者に引き継いでください。',
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral' } },
      },
    },
  ],
  model: anthropic('claude-sonnet-4-20250514'),
});
```

## コンストラクターのパラメーター \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "id",
type: "string",
isOptional: true,
description: "エージェントの任意の一意の識別子。指定がない場合は `name` が既定値になります。",
},
{
name: "name",
type: "string",
isOptional: false,
description: "エージェントの一意の識別子。",
},
{
name: "description",
type: "string",
isOptional: true,
description: "エージェントの目的や機能に関する任意の説明。",
},
{
name: "instructions",
type: "SystemMessage | ({ runtimeContext: RuntimeContext }) => SystemMessage | Promise<SystemMessage>",
isOptional: false,
description: `エージェントの挙動を導くための指示。文字列、文字列配列、system message オブジェクト、
      system message の配列、またはこれらのいずれかの型を動的に返す関数を指定できます。
      SystemMessage の型: string | string[] | CoreSystemMessage | CoreSystemMessage[] | SystemModelMessage | SystemModelMessage[]`,
},
{
name: "model",
type: "MastraLanguageModel | ({ runtimeContext: RuntimeContext }) => MastraLanguageModel | Promise<MastraLanguageModel>",
isOptional: false,
description: "エージェントが使用する言語モデル。静的に指定するか、実行時に解決できます。",
},
{
name: "agents",
type: "Record<string, Agent> | ({ runtimeContext: RuntimeContext }) => Record<string, Agent> | Promise<Record<string, Agent>>",
isOptional: true,
description: "エージェントがアクセスできるサブエージェント。静的に指定するか、動的に解決できます。",
},
{
name: "tools",
type: "ToolsInput | ({ runtimeContext: RuntimeContext }) => ToolsInput | Promise<ToolsInput>",
isOptional: true,
description: "エージェントがアクセスできるツール。静的に指定するか、動的に解決できます。",
},
{
name: "workflows",
type: "Record<string, Workflow> | ({ runtimeContext: RuntimeContext }) => Record<string, Workflow> | Promise<Record<string, Workflow>>",
isOptional: true,
description: "エージェントが実行できるワークフロー。静的または動的に解決可能です。",
},
{
name: "defaultGenerateOptions",
type: "AgentGenerateOptions | ({ runtimeContext: RuntimeContext }) => AgentGenerateOptions | Promise<AgentGenerateOptions>",
isOptional: true,
description: "`generate()` を呼び出す際に使用される既定のオプション。",
},
{
name: "defaultStreamOptions",
type: "AgentStreamOptions | ({ runtimeContext: RuntimeContext }) => AgentStreamOptions | Promise<AgentStreamOptions>",
isOptional: true,
description: "`stream()` を呼び出す際に使用される既定のオプション。",
},
{
name: "defaultStreamOptions",
type: "AgentExecutionOptions | ({ runtimeContext: RuntimeContext }) => AgentExecutionOptions | Promise<AgentExecutionOptions>",
isOptional: true,
description: "vNext モードで `stream()` を呼び出す際に使用される既定のオプション。",
},
{
name: "mastra",
type: "Mastra",
isOptional: true,
description: "Mastra ランタイムインスタンスへの参照（自動的に注入されます）。",
},
{
name: "scorers",
type: "MastraScorers | ({ runtimeContext: RuntimeContext }) => MastraScorers | Promise<MastraScorers>",
isOptional: true,
description: "実行時評価およびテレメトリーのためのスコアリング設定。静的または動的に提供可能です。",
},
{
name: "evals",
type: "Record<string, Metric>",
isOptional: true,
description: "エージェントの応答をスコアリングするための評価指標。",
},
{
name: "memory",
type: "MastraMemory | ({ runtimeContext: RuntimeContext }) => MastraMemory | Promise<MastraMemory>",
isOptional: true,
description: "状態付きコンテキストの保存および取得に使用するメモリモジュール。",
},
{
name: "voice",
type: "CompositeVoice",
isOptional: true,
description: "音声入出力の設定。",
},
{
name: "inputProcessors",
type: "Processor[] | ({ runtimeContext: RuntimeContext }) => Processor[] | Promise<Processor[]>",
isOptional: true,
description: "エージェントで処理される前にメッセージを変更または検証できる入力プロセッサ。`processInput` 関数を実装する必要があります。",
},
{
name: "outputProcessors",
type: "Processor[] | ({ runtimeContext: RuntimeContext }) => Processor[] | Promise<Processor[]>",
isOptional: true,
description: "クライアントへ送信される前に、エージェントからのメッセージを変更または検証できる出力プロセッサ。`processOutputResult` と `processOutputStream` のいずれか（または両方）を実装する必要があります。",
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "agent",
type: "Agent<TAgentId, TTools, TMetrics>",
description: "指定した設定で作成された新しい Agent インスタンス。",
},
]}
/>

## 関連情報 \{#related\}

* [エージェントの概要](/docs/agents/overview)
* [エージェントの呼び出し](/docs/examples/agents/calling-agents)