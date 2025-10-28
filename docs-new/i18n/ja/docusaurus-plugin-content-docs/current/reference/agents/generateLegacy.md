---
title: "Agent.generateLegacy()（レガシー）"
description: "Mastra のエージェントにおけるレガシーな `Agent.generateLegacy()` メソッドのドキュメント。このメソッドは非推奨で、将来のバージョンで削除される予定です。"
---

# Agent.generateLegacy()（レガシー） \{#agentgeneratelegacy-legacy\}

:::warning

**非推奨**: このメソッドは非推奨で、V1モデルでのみ動作します。V2モデルでは新しい[`.generate()`](./generate)メソッドを使用してください。アップグレードの詳細は[移行ガイド](./migration-guide)を参照してください。

:::

`.generateLegacy()` メソッドは、エージェント生成APIのレガシー版で、V1モデルのエージェントと対話してテキストまたは構造化応答を生成するために使用されます。このメソッドはメッセージと任意の生成オプションを受け取ります。

## 使い方の例 \{#usage-example\}

```typescript copy
await agent.generateLegacy('message for agent');
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "messages",
type: "string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[]",
description: "エージェントに送信するメッセージ。単一の文字列、文字列配列、またはマルチモーダルコンテンツ（テキスト、画像など）を含む構造化メッセージオブジェクトを指定できます。",
},
{
name: "options",
type: "AgentGenerateOptions",
isOptional: true,
description: "生成処理のための任意の設定。",
},
]}
/>

### オプションのパラメータ \{#options-parameters\}

<PropertiesTable
  content={[
{
  name: "abortSignal",
  type: "AbortSignal",
  isOptional: true,
  description:
    "エージェントの実行を中止できる Signal オブジェクト。シグナルが中止されると、進行中のすべての操作が停止します。"
},
{
  name: "context",
  type: "CoreMessage[]",
  isOptional: true,
  description: "エージェントに渡す追加のコンテキストメッセージ。"
},
{
  name: "structuredOutput",
  type: "StructuredOutputOptions<S extends ZodTypeAny = ZodTypeAny>",
  isOptional: true,
  description:
    "より良い開発体験で構造化出力の生成を有効にします。内部で StructuredOutputProcessor を自動生成して使用します。",
  properties: [
    {
      parameters: [
        {
          name: "schema",
          type: "z.ZodSchema<S>",
          isOptional: false,
          description: "出力を検証するための Zod スキーマ。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "model",
          type: "MastraLanguageModel",
          isOptional: false,
          description: "内部の構造化エージェントで使用するモデル。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "errorStrategy",
          type: "'strict' | 'warn' | 'fallback'",
          isOptional: true,
          description:
            "解析または検証が失敗した場合の戦略。既定は 'strict'。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "fallbackValue",
          type: "<S extends ZodTypeAny>",
          isOptional: true,
          description: "errorStrategy が 'fallback' の場合に使用するフォールバック値。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "instructions",
          type: "string",
          isOptional: true,
          description: "構造化エージェント向けのカスタム指示。"
        }
      ]
    }
  ]
},
{
  name: "outputProcessors",
  type: "Processor[]",
  isOptional: true,
  description:
    "エージェントに設定されている出力プロセッサを上書きします。ユーザーに返却する前にエージェントからのメッセージを変更または検証できる出力プロセッサです。`processOutputResult` と `processOutputStream` のいずれか（または両方）を実装する必要があります。"
},
{
  name: "inputProcessors",
  type: "Processor[]",
  isOptional: true,
  description:
    "エージェントに設定されている入力プロセッサを上書きします。エージェントで処理される前にメッセージを変更または検証できる入力プロセッサです。`processInput` 関数を実装する必要があります。"
},
{
  name: "experimental_output",
  type: "Zod schema | JsonSchema7",
  isOptional: true,
  description:
    "注: 推奨は `structuredOutput` プロパティの使用です。テキスト生成やツール呼び出しと並行して構造化出力の生成を有効にします。モデルは提供されたスキーマに準拠する応答を生成します。"
},
{
  name: "instructions",
  type: "string",
  isOptional: true,
  description:
    "この生成に限りエージェントのデフォルト指示を上書きするカスタム指示。新しいエージェントインスタンスを作成せずに動作を動的に変更するのに便利です。"
},
{
  name: "output",
  type: "Zod schema | JsonSchema7",
  isOptional: true,
  description:
    "出力の期待される構造を定義します。JSON Schema オブジェクトまたは Zod スキーマを指定できます。"
},
{
  name: "memory",
  type: "object",
  isOptional: true,
  description:
    "メモリの設定。これはメモリ管理の推奨方法です。",
  properties: [
    {
      parameters: [
        {
          name: "thread",
          type: "string | { id: string; metadata?: Record<string, any>, title?: string }",
          isOptional: false,
          description:
            "会話スレッド。文字列 ID、または `id` と任意の `metadata` を持つオブジェクト。"
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
            "メッセージ履歴やセマンティックリコールなど、メモリ動作の設定。下記の `MemoryConfig` を参照。"
        }
      ]
    }
  ]
},
{
  name: "maxSteps",
  type: "number",
  isOptional: true,
  defaultValue: "5",
  description: "許可される実行ステップ数の上限。"
},
{
  name: "maxRetries",
  type: "number",
  isOptional: true,
  defaultValue: "2",
  description: "再試行回数の上限。0 に設定すると再試行を無効化します。"
},
{
  name: "onStepFinish",
  type: "GenerateTextOnStepFinishCallback<any> | never",
  isOptional: true,
  description:
    "各実行ステップ後に呼び出されるコールバック関数。ステップの詳細を JSON 文字列で受け取ります。構造化出力では利用できません。"
},
{
  name: "runId",
  type: "string",
  isOptional: true,
  description:
    "この生成実行の一意の ID。追跡やデバッグに有用です。"
},
{
  name: "telemetry",
  type: "TelemetrySettings",
  isOptional: true,
  description: "生成中のテレメトリ収集の設定。",
  properties: [
    {
      parameters: [
        {
          name: "isEnabled",
          type: "boolean",
          isOptional: true,
          description:
            "テレメトリを有効化または無効化します。実験段階では既定で無効です。"
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
            "入力の記録を有効化または無効化します。既定で有効です。機密情報の記録を避けるために無効化する場合があります。"
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
            "出力の記録を有効化または無効化します。既定で有効です。機密情報の記録を避けるために無効化する場合があります。"
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
            "この関数の識別子。関数ごとにテレメトリデータをグループ化するために使用します。"
        }
      ]
    }
  ]
},
{
  name: "temperature",
  type: "number",
  isOptional: true,
  description:
    "モデル出力のランダム性を制御します。値が高い（例: 0.8）ほど出力はランダムになり、低い（例: 0.2）ほど一貫性が高く決定的になります。"
},
{
  name: "toolChoice",
  type: "'auto' | 'none' | 'required' | { type: 'tool'; toolName: string }",
  isOptional: true,
  defaultValue: "'auto'",
  description: "生成中にエージェントがツールをどのように使用するかを制御します。",
  properties: [
    {
      parameters: [
        {
          name: "'auto'",
          type: "string",
          description: "ツール使用の有無をモデルに任せる（デフォルト）。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "'none'",
          type: "string",
          description: "いかなるツールも使用しない。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "'required'",
          type: "string",
          description: "少なくとも 1 つのツールをモデルに使用させる。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "{ type: 'tool'; toolName: string }",
          type: "object",
          description: "特定のツールを名前で使用することを要求する。"
        }
      ]
    }
  ]
},
{
  name: "toolsets",
  type: "ToolsetsInput",
  isOptional: true,
  description:
    "生成中にエージェントが利用できる追加のツールセット。"
},
{
  name: "clientTools",
  type: "ToolsInput",
  isOptional: true,
  description:
    "リクエストの 'client' 側で実行されるツール。これらのツールは定義内に execute 関数を持ちません。"
},
{
  name: "savePerStep",
  type: "boolean",
  isOptional: true,
  description:
    "各ストリームステップの完了後にメッセージを段階的に保存する（既定: false）。"
},
{
  name: "providerOptions",
  type: "Record<string, Record<string, JSONValue>>",
  isOptional: true,
  description:
    "基盤となる LLM プロバイダに渡される、プロバイダ固有の追加オプション。構造は `{ providerName: { optionKey: value } }`。Mastra は AI SDK を拡張しているため、完全なプロバイダオプションは [AI SDK documentation](https://sdk.vercel.ai/docs/providers/ai-sdk-providers) を参照してください。",
  properties: [
    {
      parameters: [
        {
          name: "openai",
          type: "Record<string, JSONValue>",
          isOptional: true,
          description:
            "OpenAI 固有のオプション。例: `{ reasoningEffort: 'high' }`"
        }
      ]
    },
    {
      parameters: [
        {
          name: "anthropic",
          type: "Record<string, JSONValue>",
          isOptional: true,
          description:
            "Anthropic 固有のオプション。例: `{ maxTokens: 1000 }`"
        }
      ]
    },
    {
      parameters: [
        {
          name: "google",
          type: "Record<string, JSONValue>",
          isOptional: true,
          description:
            "Google 固有のオプション。例: `{ safetySettings: [...] }`"
        }
      ]
    },
    {
      parameters: [
        {
          name: "[providerName]",
          type: "Record<string, JSONValue>",
          isOptional: true,
          description:
            "その他のプロバイダー固有のオプション。キーはプロバイダー名、値はプロバイダー固有オプションのレコードです。"
        }
      ]
    }
  ]
},
{
  name: "runtimeContext",
  type: "RuntimeContext",
  isOptional: true,
  description:
    "依存性注入およびコンテキスト情報のためのランタイムコンテキスト。"
},
{
  name: "maxTokens",
  type: "number",
  isOptional: true,
  description: "生成するトークン数の上限。"
},
{
  name: "topP",
  type: "number",
  isOptional: true,
  description:
    "ニュークリアスサンプリング。0〜1 の数値です。`temperature` と `topP` はどちらか一方のみを設定することを推奨します。"
},
{
  name: "topK",
  type: "number",
  isOptional: true,
  description:
    "各後続トークンで、上位 K 個の候補からのみサンプリングします。確率が低い“ロングテール”の応答を除外するために使用します。"
},
{
  name: "presencePenalty",
  type: "number",
  isOptional: true,
  description:
    "presence penalty の設定。プロンプトにすでに含まれる情報をモデルが繰り返す可能性に影響します。-1（反復を増やす）から 1（最大のペナルティで反復を減らす）までの数値。"
},
{
  name: "frequencyPenalty",
  type: "number",
  isOptional: true,
  description:
    "frequency penalty の設定。同じ語やフレーズをモデルが繰り返し使用する可能性に影響します。-1（反復を増やす）から 1（最大のペナルティで反復を減らす）までの数値。"
},
{
  name: "stopSequences",
  type: "string[]",
  isOptional: true,
  description:
    "停止シーケンス。設定すると、いずれかの停止シーケンスが生成された時点でモデルは生成を停止します。"
},
{
  name: "seed",
  type: "number",
  isOptional: true,
  description:
    "ランダムサンプリングに使用するシード（整数）。モデルが対応しており設定されている場合、呼び出しは決定論的な結果を生成します。"
},
{
  name: "headers",
  type: "Record<string, string | undefined>",
  isOptional: true,
  description:
    "リクエストに付与する追加の HTTP ヘッダー。HTTP ベースのプロバイダーにのみ適用されます。"
}
]}
/>

## 返却値 \{#returns\}

<PropertiesTable
  content={[
{
name: "text",
type: "string",
isOptional: true,
description: "生成されたテキスト応答。出力が \"text\"（スキーマ未指定）の場合に返されます。",
},
{
name: "object",
type: "object",
isOptional: true,
description: "生成された構造化応答。`output`、`structuredOutput`、または `experimental_output` でスキーマが指定された場合に返されます。",
},
{
name: "toolCalls",
type: "Array<ToolCall>",
isOptional: true,
description: "生成処理中に行われたツール呼び出し。テキストモードとオブジェクトモードの両方で返されます。",
properties: [
{
parameters: [{
name: "toolName",
type: "string",
required: true,
description: "呼び出されたツール名。",
}]
},
{
parameters: [{
name: "args",
type: "any",
required: true,
description: "ツールに渡された引数。",
}]
}
]
},
]}
/>

## 新しい API への移行 \{#migration-to-new-api\}

:::note 非推奨のお知らせ

新しい `.generate()` メソッドは、AI SDK v5 への対応、構造化出力のより適切な取り扱い、ストリーミングの改善など、強化された機能を提供します。詳しい移行手順は [移行ガイド](./migration-guide) を参照してください。

:::

### クイック移行の例 \{#quick-migration-example\}

#### 以前（レガシー） \{#before-legacy\}

```typescript
const result = await agent.generateLegacy('message', {
  temperature: 0.7,
  maxSteps: 3,
});
```

#### 変更後（新API） \{#after-new-api\}

```typescript
const result = await agent.generate('message', {
  modelSettings: {
    temperature: 0.7,
  },
  maxSteps: 3,
});
```

## 拡張的な使用例 \{#extended-usage-example\}

```typescript showLineNumbers copy
import { z } from 'zod';
import { ModerationProcessor, TokenLimiterProcessor } from '@mastra/core/processors';

await agent.generateLegacy(
  [
    { role: 'user', content: 'エージェントへのメッセージ' },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'エージェントへのメッセージ',
        },
        {
          type: 'image',
          imageUrl: 'https://example.com/image.jpg',
          mimeType: 'image/jpeg',
        },
      ],
    },
  ],
  {
    temperature: 0.7,
    maxSteps: 3,
    memory: {
      thread: 'user-123',
      resource: 'test-app',
    },
    toolChoice: 'auto',
    providerOptions: {
      openai: {
        reasoningEffort: 'high',
      },
    },
    // 開発体験（DX）を向上させるための構造化出力
    structuredOutput: {
      schema: z.object({
        sentiment: z.enum(['positive', 'negative', 'neutral']),
        confidence: z.number(),
      }),
      model: openai('gpt-4o-mini'),
      errorStrategy: 'warn',
    },
    // 応答を検証するための出力プロセッサ
    outputProcessors: [
      new ModerationProcessor({ model: openai('gpt-4.1-nano') }),
      new TokenLimiterProcessor({ maxTokens: 1000 }),
    ],
  },
);
```

## 関連情報 \{#related\}

* [移行ガイド](./migration-guide)
* [新しい .generate() メソッド](./generate)
* [レスポンスの生成](/docs/agents/overview#generating-responses)
* [レスポンスのストリーミング](/docs/streaming/overview#streaming-with-agents)