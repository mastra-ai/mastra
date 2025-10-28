---
title: "Agent.network()（実験的）"
description: "Mastra のエージェントにおける `Agent.network()` メソッドのドキュメント。マルチエージェント間の連携とルーティングを可能にします。"
---

# Agent.network() \{#agentnetwork\}

:::caution 実験的

この機能は実験的であり、APIは今後のリリースで変更される可能性があります。

:::

`.network()` メソッドは、複数のエージェントによる協調動作とルーティングを可能にします。このメソッドは、メッセージと任意の実行オプションを受け付けます。

## 使い方の例 \{#usage-example\}

```typescript copy
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { agent1, agent2 } from './agents';
import { workflow1 } from './workflows';
import { tool1, tool2 } from './tools';

const agent = new Agent({
  name: 'network-agent',
  instructions: 'あなたはユーザーのさまざまなタスクをサポートするネットワークエージェントです。',
  model: openai('gpt-4o'),
  agents: {
    agent1,
    agent2,
  },
  workflows: {
    workflow1,
  },
  tools: {
    tool1,
    tool2,
  },
});

await agent.network(`
  東京の天気を調べてください。
  天気に基づいて、アクティビティを提案してください。
`);
```

## パラメーター \{#parameters\}

<PropertiesTable
  content={[
{
name: "messages",
type: "string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[]",
description: "エージェントに送信するメッセージ。単一の文字列、文字列配列、または構造化メッセージオブジェクトを指定できます。",
},
{
name: "options",
type: "MultiPrimitiveExecutionOptions",
isOptional: true,
description: "ネットワーク処理に関する任意の設定。",
},
]}
/>

### オプション \{#options\}

<PropertiesTable
  content={[
{
  name: "maxSteps",
  type: "number",
  isOptional: true,
  description: "実行時に実行する最大ステップ数。"
},
{
  name: "memory",
  type: "object",
  isOptional: true,
  description:
    "メモリの設定。メモリを管理する際の推奨方法です。",
  properties: [
    {
      parameters: [
        {
          name: "thread",
          type: "string | { id: string; metadata?: Record<string, any>, title?: string }",
          isOptional: false,
          description:
            "会話スレッド。文字列IDまたは`id`とオプションの`metadata`を含むオブジェクトとして指定します。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "resource",
          type: "string",
          isOptional: false,
          description:
            "スレッドに関連付けられたユーザーまたはリソースの識別子。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "options",
          type: "MemoryConfig",
          isOptional: true,
          description:
            "メッセージ履歴やセマンティックリコールなど、メモリの動作設定。"
        }
      ]
    }
  ]
},
{
  name: "tracingContext",
  type: "TracingContext",
  isOptional: true,
  description:
    "子スパンの作成とメタデータの追加のためのAIトレーシングコンテキスト。Mastraのトレーシングシステム使用時に自動的に注入されます。",
  properties: [
    {
      parameters: [
        {
          name: "currentSpan",
          type: "AISpan",
          isOptional: true,
          description:
            "子スパンの作成とメタデータの追加のための現在のAIスパン。カスタム子スパンの作成や実行中のスパン属性の更新に使用します。"
        }
      ]
    }
  ]
},
{
  name: "tracingOptions",
  type: "TracingOptions",
  isOptional: true,
  description: "AIトレーシング設定のオプション。",
  properties: [
    {
      parameters: [
        {
          name: "metadata",
          type: "Record<string, any>",
          isOptional: true,
          description:
            "ルートトレーススパンに追加するメタデータ。ユーザーID、セッションID、機能フラグなどのカスタム属性の追加に便利です。"
        }
      ]
    }
  ]
},
{
  name: "telemetry",
  type: "TelemetrySettings",
  isOptional: true,
  description:
    "ストリーミング中のOTLPテレメトリ収集の設定(AIトレーシングとは異なります)。",
  properties: [
    {
      parameters: [
        {
          name: "isEnabled",
          type: "boolean",
          isOptional: true,
          description:
            "テレメトリの有効化または無効化。実験的機能のため、デフォルトでは無効です。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "recordInputs",
          type: "boolean",
          isOptional: true,
          description:
            "入力記録の有効化または無効化。デフォルトでは有効です。機密情報の記録を避けるために無効化できます。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "recordOutputs",
          type: "boolean",
          isOptional: true,
          description:
            "出力記録の有効化または無効化。デフォルトでは有効です。機密情報の記録を避けるために無効化できます。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "functionId",
          type: "string",
          isOptional: true,
          description:
            "この関数の識別子。関数ごとにテレメトリデータをグループ化するために使用されます。"
        }
      ]
    }
  ]
},
{
  name: "modelSettings",
  type: "CallSettings",
  isOptional: true,
  description:
    "temperature、maxTokens、topPなどのモデル固有の設定。これらは基盤となる言語モデルに渡されます。",
  properties: [
    {
      parameters: [
        {
          name: "temperature",
          type: "number",
          isOptional: true,
          description:
            "モデルの出力のランダム性を制御します。高い値(例:0.8)は出力をよりランダムにし、低い値(例:0.2)はより集中的で決定論的にします。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "maxRetries",
          type: "number",
          isOptional: true,
          description: "失敗したリクエストの最大再試行回数。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "topP",
          type: "number",
          isOptional: true,
          description:
            "ニュークリアスサンプリング。0から1の間の数値です。temperatureまたはtopPのいずれかを設定することを推奨しますが、両方の設定は推奨しません。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "topK",
          type: "number",
          isOptional: true,
          description:
            "後続の各トークンについて、上位Kオプションからのみサンプリングします。低確率の「ロングテール」応答を除去するために使用されます。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "presencePenalty",
          type: "number",
          isOptional: true,
          description:
            "プレゼンスペナルティ設定。プロンプトに既に存在する情報をモデルが繰り返す可能性に影響します。-1(繰り返しを増加)から1(最大ペナルティ、繰り返しを減少)の間の数値です。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "frequencyPenalty",
          type: "number",
          isOptional: true,
          description:
            "頻度ペナルティ設定。モデルが同じ単語やフレーズを繰り返し使用する可能性に影響します。-1(繰り返しを増加)から1(最大ペナルティ、繰り返しを減少)の間の数値です。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "stopSequences",
          type: "string[]",
          isOptional: true,
          description:
            "停止シーケンス。設定されている場合、停止シーケンスのいずれかが生成されるとモデルはテキストの生成を停止します。"
        }
      ]
    }
  ]
},
{
  name: "runId",
  type: "string",
  isOptional: true,
  description:
    "この生成実行の一意のID。追跡とデバッグの目的に便利です。"
},
{
  name: "runtimeContext",
  type: "RuntimeContext",
  isOptional: true,
  description:
    "依存性注入とコンテキスト情報のためのランタイムコンテキスト。"
},
{
  name: "traceId",
  type: "string",
  isOptional: true,
  description:
    "AIトレーシングが有効な場合にこの実行に関連付けられたトレースID。ログの相関付けと実行フローのデバッグに使用します。"
}
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "stream",
type: "MastraAgentNetworkStream<NetworkChunkType>",
description: "ReadableStream<NetworkChunkType> を拡張し、ネットワーク固有のプロパティを追加したカスタムストリーム",
},
{
name: "status",
type: "Promise<RunStatus>",
description: "現在のワークフロー実行ステータスを解決する Promise",
},
{
name: "result",
type: "Promise<WorkflowResult<TState, TOutput, TSteps>>",
description: "最終的なワークフロー結果を解決する Promise",
},
{
name: "usage",
type: "Promise<{ promptTokens: number; completionTokens: number; totalTokens: number }>",
description: "トークン使用状況の統計情報を解決する Promise",
},
]}
/>