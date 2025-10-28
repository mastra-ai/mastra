---
title: "Agent.generate()"
description: "Mastra エージェントの `Agent.generate()` メソッドに関するドキュメント。強化された機能を活用し、ストリーミングなしでレスポンスを生成します。"
---

# Agent.generate() \{#agentgenerate\}

`.generate()` メソッドは、エージェントからの非ストリーミング応答を、拡張機能と柔軟な出力形式で生成できます。メッセージと任意の生成オプションを受け取り、Mastra のネイティブ形式と AI SDK v5 互換の両方に対応します。

## 使い方の例 \{#usage-example\}

```typescript copy
// Mastra のデフォルト形式
const mastraResult = await agent.generate('message for agent');

// AI SDK v5 と互換の形式
const aiSdkResult = await agent.generate('message for agent', {
  format: 'aisdk',
});
```

:::note モデルの互換性

このメソッドは V2 モデル向けに設計されています。V1 モデルは [`.generateLegacy()`](./generateLegacy) メソッドを使用してください。フレームワークはモデルのバージョンを自動検出し、ミスマッチがある場合はエラーを発生させます。

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
description: "生成処理に関する任意設定。",
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
    "出力形式を指定します。Mastraのネイティブ形式には'mastra'(デフォルト)を、AI SDK v5との互換性には'aisdk'を使用します。"
},
{
  name: "maxSteps",
  type: "number",
  isOptional: true,
  description: "実行時の最大ステップ数。"
},
{
  name: "scorers",
  type: "MastraScorers | Record<string, { scorer: MastraScorer['name']; sampling?: ScoringSamplingConfig }>",
  isOptional: true,
  description: "実行結果の評価に使用するスコアラー。",
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
                    "サンプリング戦略のタイプ。サンプリングを無効にする場合は'none'、パーセンテージベースのサンプリングには'ratio'を使用します。"
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
                    "サンプリングレート(0-1)。typeが'ratio'の場合は必須です。"
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
  description: "スパン階層とメタデータのためのAIトレーシングコンテキスト。"
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
  description: "生成中の各チャンクごとに呼び出されるコールバック関数。"
},
{
  name: "onError",
  type: "({ error }: { error: Error | string }) => Promise<void> | void",
  isOptional: true,
  description:
    "生成中にエラーが発生した際に呼び出されるコールバック関数。"
},
{
  name: "onAbort",
  type: "(event: any) => Promise<void> | void",
  isOptional: true,
  description: "生成が中止された際に呼び出されるコールバック関数。"
},
{
  name: "activeTools",
  type: "Array<keyof ToolSet> | undefined",
  isOptional: true,
  description:
    "実行中にアクティブにするツール名の配列。undefinedの場合、利用可能なすべてのツールがアクティブになります。"
},
{
  name: "abortSignal",
  type: "AbortSignal",
  isOptional: true,
  description:
    "エージェントの実行を中止するためのシグナルオブジェクト。シグナルが中止されると、進行中のすべての操作が終了します。"
},
{
  name: "prepareStep",
  type: "PrepareStepFunction<any>",
  isOptional: true,
  description:
    "マルチステップ実行の各ステップ前に呼び出されるコールバック関数。"
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
    "構造化出力生成を有効にし、より良い開発者体験を提供します。内部的にStructuredOutputProcessorを自動的に作成して使用します。",
  properties: [
    {
      parameters: [
        {
          name: "schema",
          type: "z.ZodSchema<S>",
          isOptional: false,
          description: "期待される出力構造を定義するZodスキーマ。"
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
            "構造化出力生成に使用する言語モデル。指定しない場合は、エージェントのデフォルトモデルを使用します。"
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
            "スキーマ検証エラーの処理戦略。'strict'はエラーをスローし、'warn'は警告をログに記録し、'fallback'はフォールバック値を使用します。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "fallbackValue",
          type: "<S extends ZodTypeAny>",
          isOptional: true,
          description:
            "スキーマ検証が失敗し、errorStrategyが'fallback'の場合に使用するフォールバック値。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "instructions",
          type: "string",
          isOptional: true,
          description:
            "構造化出力生成のための追加の指示。"
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
    "この実行で使用する出力プロセッサー(エージェントのデフォルトを上書きします)。"
},
{
  name: "inputProcessors",
  type: "Processor[]",
  isOptional: true,
  description:
    "この実行で使用する入力プロセッサー(エージェントのデフォルトを上書きします)。"
},
{
  name: "instructions",
  type: "string",
  isOptional: true,
  description:
    "この実行でエージェントのデフォルト指示を上書きするカスタム指示。"
},
{
  name: "system",
  type: "string | string[] | CoreSystemMessage | SystemModelMessage | CoreSystemMessage[] | SystemModelMessage[]",
  isOptional: true,
  description:
    "プロンプトに含めるカスタムシステムメッセージ。単一の文字列、メッセージオブジェクト、またはそれらの配列を指定できます。システムメッセージは、エージェントのメイン指示を補完する追加のコンテキストや動作指示を提供します。"
},
{
  name: "output",
  type: "Zod schema | JsonSchema7",
  isOptional: true,
  description:
    "**非推奨。** 同じ機能を実現するには、maxSteps:1でstructuredOutputを使用してください。出力の期待される構造を定義します。JSONスキーマオブジェクトまたはZodスキーマを指定できます。"
},
{
  name: "memory",
  type: "object",
  isOptional: true,
  description:
    "会話の永続化と取得のためのメモリ設定。",
  properties: [
    {
      parameters: [
        {
          name: "thread",
          type: "string | { id: string; metadata?: Record<string, any>, title?: string }",
          isOptional: false,
          description:
            "会話の継続性のためのスレッド識別子。文字列IDまたはIDとオプションのメタデータ/タイトルを含むオブジェクトを指定できます。"
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
            "ユーザー、セッション、またはコンテキストごとに会話を整理するためのリソース識別子。"
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
            "会話管理のための追加のメモリ設定オプション。"
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
    "生成が完了した際に実行されるコールバック。タイプは形式によって異なります。"
},
{
  name: "onStepFinish",
  type: "StreamTextOnStepFinishCallback<any> | never",
  isOptional: true,
  description:
    "各生成ステップ後に実行されるコールバック。タイプは形式によって異なります。"
},
{
  name: "resourceId",
  type: "string",
  isOptional: true,
  description:
    "非推奨。代わりにmemory.resourceを使用してください。リソース/ユーザーの識別子。"
},
{
  name: "telemetry",
  type: "TelemetrySettings",
  isOptional: true,
  description:
    "生成中のOTLPテレメトリ収集の設定(AIトレーシングではありません)。",
  properties: [
    {
      parameters: [
        {
          name: "isEnabled",
          type: "boolean",
          isOptional: true,
          description: "テレメトリ収集を有効にするかどうか。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "recordInputs",
          type: "boolean",
          isOptional: true,
          description: "テレメトリに入力データを記録するかどうか。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "recordOutputs",
          type: "boolean",
          isOptional: true,
          description: "テレメトリに出力データを記録するかどうか。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "functionId",
          type: "string",
          isOptional: true,
          description: "実行される関数の識別子。"
        }
      ]
    }
  ]
},
{
  name: "modelSettings",
  type: "CallSettings",
  isOptional: true,
  description: "temperature、topPなどのモデル固有の設定",
  properties: [
    {
      parameters: [
        {
          name: "temperature",
          type: "number",
          isOptional: true,
          description:
            "生成時のランダム性を制御します(0-2)。値が高いほど出力がランダムになります。"
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
            "ニュークリアスサンプリングパラメータ(0-1)。生成されるテキストの多様性を制御します。"
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
            "Top-kサンプリングパラメータ。語彙を最も可能性の高いk個のトークンに制限します。"
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
            "トークンの存在に対するペナルティ(-2から2)。繰り返しを抑制します。"
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
            "トークンの頻度に対するペナルティ(-2から2)。頻出トークンの繰り返しを抑制します。"
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
            "検出時に生成を停止する文字列の配列。"
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
    "非推奨。代わりにmemory.threadを使用してください。会話の継続性を保つためのスレッド識別子。"
},
{
  name: "toolChoice",
  type: "'auto' | 'none' | 'required' | { type: 'tool'; toolName: string }",
  isOptional: true,
  description: "生成時のツール選択方法を制御します。",
  properties: [
    {
      parameters: [
        {
          name: "'auto'",
          type: "string",
          isOptional: false,
          description: "モデルにツールの使用タイミングを判断させます(デフォルト)。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "'none'",
          type: "string",
          isOptional: false,
          description: "ツールの使用を完全に無効化します。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "'required'",
          type: "string",
          isOptional: false,
          description: "モデルに少なくとも1つのツールを使用させます。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "{ type: 'tool'; toolName: string }",
          type: "object",
          isOptional: false,
          description: "モデルに特定のツールを使用させます。"
        }
      ]
    }
  ]
},
{
  name: "toolsets",
  type: "ToolsetsInput",
  isOptional: true,
  description: "この実行で使用可能な追加のツールセット。"
},
{
  name: "clientTools",
  type: "ToolsInput",
  isOptional: true,
  description: "実行時に利用可能なクライアント側ツール。"
},
{
  name: "savePerStep",
  type: "boolean",
  isOptional: true,
  description:
    "各生成ステップの完了後にメッセージを段階的に保存します(デフォルト: false)。"
},
{
  name: "providerOptions",
  type: "Record<string, Record<string, JSONValue>>",
  isOptional: true,
  description: "言語モデルに渡されるプロバイダー固有のオプション。",
  properties: [
    {
      parameters: [
        {
          name: "openai",
          type: "Record<string, JSONValue>",
          isOptional: true,
          description:
            "reasoningEffort、responseFormatなどのOpenAI固有のオプション。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "anthropic",
          type: "Record<string, JSONValue>",
          isOptional: true,
          description: "maxTokensなどのAnthropic固有のオプション。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "google",
          type: "Record<string, JSONValue>",
          isOptional: true,
          description: "Google固有のオプション。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "[providerName]",
          type: "Record<string, JSONValue>",
          isOptional: true,
          description: "任意のプロバイダー固有のオプション。"
        }
      ]
    }
  ]
},
{
  name: "runId",
  type: "string",
  isOptional: true,
  description: "この実行の一意の識別子。"
},
{
  name: "runtimeContext",
  type: "RuntimeContext",
  isOptional: true,
  description: "動的な設定と状態を含むランタイムコンテキスト。"
},
{
  name: "tracingContext",
  type: "TracingContext",
  isOptional: true,
  description:
    "子スパンの作成とメタデータの追加のためのAIトレーシングコンテキスト。Mastraのトレーシングシステムを使用する際に自動的に注入されます。",
  properties: [
    {
      parameters: [
        {
          name: "currentSpan",
          type: "AISpan",
          isOptional: true,
          description:
            "子スパンの作成とメタデータの追加のための現在のAIスパン。実行中にカスタム子スパンを作成したり、スパン属性を更新したりする際に使用します。"
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
            "ルートトレーススパンに追加するメタデータ。ユーザーID、セッションID、機能フラグなどのカスタム属性を追加する際に便利です。"
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
    "実行を停止する条件(例: ステップ数、トークン制限)。"
}
]}
/>

## 返り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "result",
type: "Awaited<ReturnType<MastraModelOutput<Output>['getFullOutput']>> | Awaited<ReturnType<AISDKV5OutputStream<Output>['getFullOutput']>>",
description: "生成処理の完全な出力を返します。format が 'mastra'（デフォルト）の場合は MastraModelOutput の結果を、format が 'aisdk' の場合は AI SDK v5 互換の AISDKV5OutputStream の結果を返します。",
},
{
name: "traceId",
type: "string",
isOptional: true,
description: "AI トレーシングが有効な場合、この実行に関連付けられるトレース ID です。これを使用してログを相関させ、実行フローのデバッグに役立てます。",
},
]}
/>