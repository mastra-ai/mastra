---
title: "Agent.stream() "
description: "Mastra エージェントの `Agent.stream()` メソッドに関するドキュメント。拡張機能により、応答をリアルタイムでストリーミングできます。"
---

# Agent.stream() \{#agentstream\}

`.stream()` メソッドは、拡張機能と柔軟なフォーマットにより、エージェントの応答をリアルタイムでストリーミングできます。このメソッドはメッセージと任意のストリーミングオプションを受け取り、Mastra のネイティブ形式と AI SDK v5 互換の両方に対応した次世代のストリーミング体験を提供します。

## 使い方 \{#usage-example\}

```ts filename="index.ts" copy
// デフォルトのMastra形式
const mastraStream = await agent.stream('message for agent');

// AI SDK v5互換形式
const aiSdkStream = await agent.stream('message for agent', {
  format: 'aisdk',
});
```

:::note モデルの互換性

このメソッドは V2 モデル向けに設計されています。V1 モデルは [`.streamLegacy()`](./streamLegacy) メソッドを使用してください。フレームワークはモデルのバージョンを自動的に検出し、ミスマッチがある場合はエラーを発生させます。

:::

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "messages",
type: "string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[]",
description: "エージェントに送信するメッセージ。単一の文字列、文字列配列、または構造化メッセージオブジェクトを指定できます。",
},
{
name: "options",
type: "AgentExecutionOptions<Output, StructuredOutput, Format>",
isOptional: true,
description: "ストリーミング処理に関する任意の設定。",
},
]}
/>

### オプション \{#options\}

<PropertiesTable
  content={[
{
  name: "format",
  type: "'mastra' | 'aisdk'",
  isOptional: true,
  defaultValue: "'mastra'",
  description:
    "出力ストリーム形式を指定します。既定では Mastra のネイティブ形式である 'mastra' を使用し、AI SDK v5 との互換性には 'aisdk' を使用します。"
},
{
  name: "maxSteps",
  type: "number",
  isOptional: true,
  description: "実行時に実行する最大ステップ数。"
},
{
  name: "scorers",
  type: "MastraScorers | Record<string, { scorer: MastraScorer['name']; sampling?: ScoringSamplingConfig }>",
  isOptional: true,
  description: "実行結果に対して実行する評価スコアラー。",
  properties: [
    {
      parameters: [
        {
          name: "scorer",
          type: "string",
          isOptional: false,
          description: "使用するスコアラーの名前。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "sampling",
          type: "ScoringSamplingConfig",
          isOptional: true,
          description: "スコアラーのサンプリング設定。",
          properties: [
            {
              parameters: [
                {
                  name: "type",
                  type: "'none' | 'ratio'",
                  isOptional: false,
                  description:
                    "サンプリング戦略の種類。サンプリングを無効にする場合は 'none'、割合ベースのサンプリングには 'ratio' を使用します。"
                }
              ]
            },
            {
              parameters: [
                {
                  name: "rate",
                  type: "number",
                  isOptional: true,
                  description:
                    "サンプリング率（0〜1）。type が 'ratio' の場合に必須。"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
},
{
  name: "tracingContext",
  type: "TracingContext",
  isOptional: true,
  description: "スパンの階層とメタデータのための AI トレーシングコンテキスト。"
},
{
  name: "returnScorerData",
  type: "boolean",
  isOptional: true,
  description: "レスポンスに詳細なスコアリングデータを含めるかどうか。"
},
{
  name: "onChunk",
  type: "(chunk: ChunkType) => Promise<void> | void",
  isOptional: true,
  description: "ストリーミング中に各チャンクごとに呼び出されるコールバック関数。"
},
{
  name: "onError",
  type: "({ error }: { error: Error | string }) => Promise<void> | void",
  isOptional: true,
  description:
    "ストリーミング中にエラーが発生したときに呼び出されるコールバック関数。"
},
{
  name: "onAbort",
  type: "(event: any) => Promise<void> | void",
  isOptional: true,
  description: "ストリームが中断されたときに呼び出されるコールバック関数。"
},
{
  name: "abortSignal",
  type: "AbortSignal",
  isOptional: true,
  description:
    "エージェントの実行を中止できる Signal オブジェクト。シグナルが中止されると、進行中のすべての操作が終了します。"
},
{
  name: "activeTools",
  type: "Array<keyof ToolSet> | undefined",
  isOptional: true,
  description: "実行時に使用可能なアクティブなツール名の配列。"
},
{
  name: "prepareStep",
  type: "PrepareStepFunction<any>",
  isOptional: true,
  description:
    "マルチステップ実行の各ステップの前に呼び出されるコールバック関数。"
},
{
  name: "context",
  type: "ModelMessage[]",
  isOptional: true,
  description: "エージェントに提供する追加のコンテキストメッセージ。"
},
{
  name: "structuredOutput",
  type: "StructuredOutputOptions<S extends ZodTypeAny = ZodTypeAny>",
  isOptional: true,
  description:
    "構造化出力の生成を有効にし、開発体験を向上させます。内部で StructuredOutputProcessor を自動作成して使用します。",
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
          isOptional: true,
          description:
            "内部の構造化エージェントに使用するモデル。指定しない場合はエージェントのモデルが使用されます。"
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
            "解析または検証に失敗した場合の方針。既定は 'strict'。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "fallbackValue",
          type: "<S extends ZodTypeAny>",
          isOptional: true,
          description: "errorStrategy が 'fallback' の場合のフォールバック値。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "instructions",
          type: "string",
          isOptional: true,
          description: "構造化エージェントへのカスタム指示。"
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
    "エージェントに設定された出力プロセッサーを上書きします。ユーザーに返される前にエージェントからのメッセージを変更または検証できます。`processOutputResult` と `processOutputStream` のいずれか（または両方）を実装する必要があります。"
},
{
  name: "inputProcessors",
  type: "Processor[]",
  isOptional: true,
  description:
    "エージェントに設定された入力プロセッサーを上書きします。エージェントで処理される前にメッセージを変更または検証できます。`processInput` 関数を実装する必要があります。"
},
{
  name: "instructions",
  type: "string",
  isOptional: true,
  description:
    "この生成に対してエージェントの既定の指示を上書きするカスタム指示。新しいエージェントインスタンスを作成せずに、エージェントの挙動を動的に変更するのに便利です。"
},
{
  name: "system",
  type: "string | string[] | CoreSystemMessage | SystemModelMessage | CoreSystemMessage[] | SystemModelMessage[]",
  isOptional: true,
  description:
    "プロンプトに含めるカスタムのシステムメッセージ。単一の文字列、メッセージオブジェクト、またはいずれかの配列を指定できます。システムメッセージは、エージェントの主指示を補足する追加のコンテキストや挙動の指示を提供します。"
},
{
  name: "output",
  type: "Zod schema | JsonSchema7",
  isOptional: true,
  description:
    "**非推奨。** 同等の機能は structuredOutput と maxSteps:1 を使用してください。出力の期待される構造を定義します。JSON Schema オブジェクトまたは Zod スキーマを指定できます。"
},
{
  name: "memory",
  type: "object",
  isOptional: true,
  description:
    "メモリの設定。メモリ管理の推奨方法です。",
  properties: [
    {
      parameters: [
        {
          name: "thread",
          type: "string | { id: string; metadata?: Record<string, any>, title?: string }",
          isOptional: false,
          description:
            "会話スレッド。文字列 ID、または `id` と任意の `metadata` を含むオブジェクトとして指定します。"
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
            "メッセージ履歴やセマンティックリコールなど、メモリ動作の設定。"
        }
      ]
    }
  ]
},
{
  name: "onFinish",
  type: "StreamTextOnFinishCallback<any> | StreamObjectOnFinishCallback<OUTPUT>",
  isOptional: true,
  description:
    "ストリーミングが完了したときに呼び出されるコールバック関数。最終結果を受け取ります。"
},
{
  name: "onStepFinish",
  type: "StreamTextOnStepFinishCallback<any> | never",
  isOptional: true,
  description:
    "各実行ステップ後に呼び出されるコールバック関数。ステップの詳細を JSON 文字列で受け取ります。構造化出力では利用できません。"
},
{
  name: "resourceId",
  type: "string",
  isOptional: true,
  description:
    "**非推奨。** 代わりに `memory.resource` を使用してください。エージェントとやり取りするユーザーまたはリソースの識別子。threadId が指定されている場合は必須です。"
},
{
  name: "telemetry",
  type: "TelemetrySettings",
  isOptional: true,
  description:
    "ストリーミング中（AI トレーシングではない）の OTLP テレメトリー収集の設定。",
  properties: [
    {
      parameters: [
        {
          name: "isEnabled",
          type: "boolean",
          isOptional: true,
          description:
            "テレメトリーを有効または無効にします。実験段階の間は既定で無効です。"
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
            "入力の記録を有効または無効にします。既定で有効です。機微な情報の記録を避けるため、入力記録を無効にしたい場合があります。"
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
            "出力の記録を有効または無効にします。デフォルトで有効です。機密情報の記録を避けるために、出力の記録を無効にする場合があります。"
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
            "この関数の識別子。テレメトリーデータを関数単位でグルーピングするために使用されます。"
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
    "temperature、maxTokens、topP などのモデル固有設定。これらは基盤の言語モデルに渡されます。",
  properties: [
    {
      parameters: [
        {
          name: "temperature",
          type: "number",
          isOptional: true,
          description:
            "モデル出力のランダム性を制御します。値が高い（例: 0.8）ほど出力はランダムになり、値が低い（例: 0.2）ほど集中度が高く決定的になります。"
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
            "Nucleus サンプリング。0～1 の数値です。temperature か topP のどちらか一方のみを設定することが推奨されます。"
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
            "各後続トークンごとに上位 K 個の選択肢からのみサンプリングします。確率が低い「ロングテール」の応答を除外するために使用されます。"
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
            "presence penalty の設定。プロンプトに既に含まれる情報をモデルが繰り返す可能性に影響します。-1（繰り返しを増やす）から 1（最大のペナルティで繰り返しを減らす）までの数値です。"
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
            "frequency penalty の設定。同じ語やフレーズを繰り返し使用する可能性に影響します。-1（繰り返しを増やす）から 1（最大のペナルティで繰り返しを減らす）までの数値です。"
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
            "停止シーケンス。設定されている場合、停止シーケンスのいずれかが生成されるとモデルはテキスト生成を停止します。"
        }
      ]
    }
  ]
},
{
  name: "threadId",
  type: "string",
  isOptional: true,
  description:
    "**非推奨。** 代わりに `memory.thread` を使用してください。会話スレッドの識別子。複数のやり取りにわたってコンテキストを維持するために使用します。resourceId が指定されている場合は必須です。"
},
{
  name: "toolChoice",
  type: "'auto' | 'none' | 'required' | { type: 'tool'; toolName: string }",
  isOptional: true,
  defaultValue: "'auto'",
  description: "ストリーミング中にエージェントがツールをどのように使用するかを制御します。",
  properties: [
    {
      parameters: [
        {
          name: "'auto'",
          type: "string",
          description: "ツールを使うかどうかをモデルに任せます（デフォルト）。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "'none'",
          type: "string",
          description: "ツールを一切使用しません。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "'required'",
          type: "string",
          description: "モデルに少なくとも 1 つのツールの使用を必須にします。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "{ type: 'tool'; toolName: string }",
          type: "object",
          description: "モデルに特定のツールを名前で使用することを必須にします。"
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
    "ストリーミング中にエージェントが利用できる追加のツールセット。",
},
{
  name: "clientTools",
  type: "ToolsInput",
  isOptional: true,
  description:
    "リクエストの「クライアント」側で実行されるツール。これらのツールには定義内に execute 関数がありません。",
},
{
  name: "savePerStep",
  type: "boolean",
  isOptional: true,
  description:
    "各ストリームステップの完了後にメッセージを段階的に保存します（デフォルト: false）。"
},
{
  name: "providerOptions",
  type: "Record<string, Record<string, JSONValue>>",
  isOptional: true,
  description:
    "基盤の LLM プロバイダーに渡される、追加のプロバイダー固有オプション。構造は `{ providerName: { optionKey: value } }` です。例: `{ openai: { reasoningEffort: 'high' }, anthropic: { maxTokens: 1000 } }`。",
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
            "その他のプロバイダー固有オプション。キーはプロバイダー名、値はプロバイダー固有オプションのレコードです。"
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
    "この生成実行の一意の ID。追跡やデバッグに役立ちます。"
},
{
  name: "runtimeContext",
  type: "RuntimeContext",
  isOptional: true,
  description:
    "依存性注入とコンテキスト情報のためのランタイムコンテキスト。"
},
{
  name: "tracingContext",
  type: "TracingContext",
  isOptional: true,
  description:
    "AI トレーシング用のコンテキスト。子スパンの作成やメタデータの追加に使用します。Mastra のトレーシングシステムを使用している場合は自動的に注入されます。",
  properties: [
    {
      parameters: [
        {
          name: "currentSpan",
          type: "AISpan",
          isOptional: true,
          description:
            "子スパンの作成やメタデータの追加に使用する現在の AI スパン。実行中にカスタムの子スパンを作成したり、スパン属性を更新したりするために使用します。"
        }
      ]
    }
  ]
},
{
  name: "tracingOptions",
  type: "TracingOptions",
  isOptional: true,
  description: "AI トレーシング設定のオプション。",
  properties: [
    {
      parameters: [
        {
          name: "metadata",
          type: "Record<string, any>",
          isOptional: true,
          description:
            "ルートのトレーススパンに追加するメタデータ。ユーザー ID、セッション ID、フィーチャーフラグなどのカスタム属性を追加するのに便利です。"
        }
      ]
    }
  ]
},
{
  name: "maxTokens",
  type: "number",
  isOptional: true,
  description:
    "エージェントの実行を停止する条件。単一の条件または条件の配列を指定できます。"
}
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "stream",
type: "MastraModelOutput<Output> | AISDKV5OutputStream<Output>",
description: "format パラメータに応じたストリーミングインターフェースを返します。format が 'mastra'（デフォルト）の場合は MastraModelOutput、'aisdk' の場合は AI SDK v5 互換の AISDKV5OutputStream を返します。",
},
{
name: "traceId",
type: "string",
isOptional: true,
description: "AI トレーシングが有効な場合、この実行に関連付けられるトレース ID。ログの突き合わせや実行フローのデバッグに使用します。",
},
]}
/>

## 応用的な使用例 \{#extended-usage-example\}

### Mastra フォーマット（デフォルト） \{#mastra-format-default\}

```ts filename="index.ts" showLineNumbers copy
import { stepCountIs } from 'ai-v5';

const stream = await agent.stream('物語を聞かせて', {
  stopWhen: stepCountIs(3), // 3ステップで停止
  modelSettings: {
    temperature: 0.7,
  },
});

// テキストストリームへアクセス
for await (const chunk of stream.textStream) {
  console.log(chunk);
}

// ストリーミング完了後に全文を取得
const fullText = await stream.text;
```

### AI SDK v5 のフォーマット \{#ai-sdk-v5-format\}

```ts filename="index.ts" showLineNumbers copy
import { stepCountIs } from 'ai-v5';

const stream = await agent.stream('物語を聞かせて', {
  format: 'aisdk',
  stopWhen: stepCountIs(3), // 3ステップ後に停止
  modelSettings: {
    temperature: 0.7,
  },
});

// AI SDK v5互換インターフェースで使用
for await (const part of stream.fullStream) {
  if (part.type === 'text-delta') {
    console.log(part.text);
  }
}

// フロントエンド統合用のAPIルート内
return stream.toUIMessageStreamResponse();
```

### コールバックの使用 \{#using-callbacks\}

すべてのコールバック関数は、より洗練された API 体験のため、トップレベルのプロパティとして利用できるようになりました。

```ts filename="index.ts" showLineNumbers copy
const stream = await agent.stream('物語を聞かせて', {
  onFinish: result => {
    console.log('ストリーミング完了:', result);
  },
  onStepFinish: step => {
    console.log('ステップ完了:', step);
  },
  onChunk: chunk => {
    console.log('チャンク受信:', chunk);
  },
  onError: ({ error }) => {
    console.error('ストリーミングエラー:', error);
  },
  onAbort: event => {
    console.log('ストリーム中止:', event);
  },
});

// ストリームを処理
for await (const chunk of stream.textStream) {
  console.log(chunk);
}
```

### オプションを使った高度な例 \{#advanced-example-with-options\}

```ts filename="index.ts" showLineNumbers copy
import { z } from 'zod';
import { stepCountIs } from 'ai-v5';

await agent.stream('エージェントへのメッセージ', {
  format: 'aisdk', // AI SDK v5 との互換性を有効化
  stopWhen: stepCountIs(3), // 3 ステップで停止
  modelSettings: {
    temperature: 0.7,
  },
  memory: {
    thread: 'user-123',
    resource: 'test-app',
  },
  toolChoice: 'auto',
  // 開発体験（DX）を高めるための構造化出力
  structuredOutput: {
    schema: z.object({
      sentiment: z.enum(['positive', 'negative', 'neutral']),
      confidence: z.number(),
    }),
    model: openai('gpt-4o-mini'),
    errorStrategy: 'warn',
  },
  // ストリーミング応答の検証用出力プロセッサ
  outputProcessors: [
    new ModerationProcessor({ model: openai('gpt-4.1-nano') }),
    new BatchPartsProcessor({ maxBatchSize: 3, maxWaitTime: 100 }),
  ],
});
```

## 関連項目 \{#related\}

* [応答の生成](/docs/agents/overview#generating-responses)
* [エージェントによるストリーミング応答](/docs/streaming/overview#streaming-with-agents)