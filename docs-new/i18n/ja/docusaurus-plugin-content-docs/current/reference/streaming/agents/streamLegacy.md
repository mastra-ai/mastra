---
title: "Agent.streamLegacy()（旧式）"
description: "Mastra のエージェントにおける旧式の `Agent.streamLegacy()` メソッドのドキュメント。このメソッドは非推奨で、将来のバージョンで削除されます。"
---

# Agent.streamLegacy()（レガシー） \{#agentstreamlegacy-legacy\}

:::warning

**非推奨**: このメソッドは非推奨で、V1 モデルでのみ動作します。V2 モデルでは新しい [`.stream()`](./stream) メソッドを使用してください。アップグレードの詳細は [移行ガイド](/docs/reference/agents/migration-guide) を参照してください。

:::

`.streamLegacy()` メソッドは、エージェントのストリーミング API の旧版で、V1 モデルのエージェントからの応答をリアルタイムにストリーミングするために使用されます。このメソッドはメッセージと任意のストリーミングオプションを受け取ります。

## 使い方の例 \{#usage-example\}

```typescript copy
await agent.streamLegacy('エージェント用のメッセージ');
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "messages",
type: "string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[]",
description: "エージェントに送信するメッセージ。単一の文字列、文字列の配列、または構造化メッセージオブジェクトを指定できます。",
},
{
name: "options",
type: "AgentStreamOptions<OUTPUT, EXPERIMENTAL_OUTPUT>",
isOptional: true,
description: "ストリーミング処理用のオプション設定。",
},
]}
/>

### オプションパラメータ \{#options-parameters\}

<PropertiesTable
  content={[
{
  name: "abortSignal",
  type: "AbortSignal",
  isOptional: true,
  description:
    "エージェントの実行を中止できるSignalオブジェクト。シグナルが中止されると、進行中のすべての操作が終了します。"
},
{
  name: "context",
  type: "CoreMessage[]",
  isOptional: true,
  description: "エージェントに提供する追加のコンテキストメッセージ。"
},
{
  name: "experimental_output",
  type: "Zod schema | JsonSchema7",
  isOptional: true,
  description:
    "テキスト生成とツール呼び出しに加えて、構造化された出力生成を有効にします。モデルは提供されたスキーマに準拠した応答を生成します。"
},
{
  name: "instructions",
  type: "string",
  isOptional: true,
  description:
    "この生成に対してエージェントのデフォルト指示を上書きするカスタム指示。新しいエージェントインスタンスを作成せずにエージェントの動作を動的に変更する場合に便利です。"
},
{
  name: "output",
  type: "Zod schema | JsonSchema7",
  isOptional: true,
  description:
    "出力の期待される構造を定義します。JSONスキーマオブジェクトまたはZodスキーマを指定できます。"
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
            "会話スレッド。文字列IDまたは`id`とオプションの`metadata`を持つオブジェクトとして指定します。"
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
            "メッセージ履歴やセマンティックリコールなど、メモリの動作に関する設定。"
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
  description: "許可される実行ステップの最大数。"
},
{
  name: "maxRetries",
  type: "number",
  isOptional: true,
  defaultValue: "2",
  description: "最大リトライ回数。リトライを無効にする場合は0に設定します。"
},
{
  name: "memoryOptions",
  type: "MemoryConfig",
  isOptional: true,
  description:
    "**非推奨。** 代わりに`memory.options`を使用してください。メモリ管理の設定オプション。",
  properties: [
    {
      parameters: [
        {
          name: "lastMessages",
          type: "number | false",
          isOptional: true,
          description:
            "コンテキストに含める最近のメッセージの数、または無効にする場合はfalse。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "semanticRecall",
          type: "boolean | { topK: number; messageRange: number | { before: number; after: number }; scope?: 'thread' | 'resource' }",
          isOptional: true,
          description:
            "関連する過去のメッセージを検索するためにセマンティックリコールを有効にします。ブール値または詳細な設定を指定できます。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "workingMemory",
          type: "WorkingMemory",
          isOptional: true,
          description: "ワーキングメモリ機能の設定。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "threads",
          type: "{ generateTitle?: boolean | { model: DynamicArgument<MastraLanguageModel>; instructions?: DynamicArgument<string> } }",
          isOptional: true,
          description:
            "自動タイトル生成を含む、スレッド固有の設定。"
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
    "各実行ステップの後に呼び出されるコールバック関数。ステップの詳細をJSON文字列として受け取ります。構造化された出力では使用できません"
},
{
  name: "resourceId",
  type: "string",
  isOptional: true,
  description:
    "**非推奨。** 代わりに`memory.resource`を使用してください。エージェントと対話するユーザーまたはリソースの識別子。threadIdが指定される場合は必須です。"
},
{
  name: "telemetry",
  type: "TelemetrySettings",
  isOptional: true,
  description: "ストリーミング中のテレメトリ収集の設定。",
  properties: [
    {
      parameters: [
        {
          name: "isEnabled",
          type: "boolean",
          isOptional: true,
          description:
            "テレメトリを有効または無効にします。実験的機能のため、デフォルトでは無効です。"
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
            "入力記録を有効または無効にします。デフォルトでは有効です。機密情報の記録を避けるために入力記録を無効にできます。"
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
            "出力記録を有効または無効にします。デフォルトでは有効です。機密情報の記録を避けるために出力記録を無効にできます。"
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
  name: "temperature",
  type: "number",
  isOptional: true,
  description:
    "モデルの出力のランダム性を制御します。高い値(例:0.8)は出力をよりランダムにし、低い値(例:0.2)はより集中的で決定論的にします。"
},
{
  name: "threadId",
  type: "string",
  isOptional: true,
  description:
    "**非推奨。** 代わりに`memory.thread`を使用してください。会話スレッドの識別子。複数のやり取りにわたってコンテキストを維持できます。resourceIdが指定される場合は必須です。"
},
{
  name: "toolChoice",
  type: "'auto' | 'none' | 'required' | { type: 'tool'; toolName: string }",
  isOptional: true,
  defaultValue: "'auto'",
  description: "ストリーミング中にエージェントがツールを使用する方法を制御します。",
  properties: [
    {
      parameters: [
        {
          name: "'auto'",
          type: "string",
          description: "モデルにツールを使用するかどうかを決定させます(デフォルト)。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "'none'",
          type: "string",
          description: "ツールを使用しません。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "'required'",
          type: "string",
          description: "モデルに少なくとも1つのツールを使用することを要求します。"
        }
      ]
    },
    {
      parameters: [
        {
          name: "{ type: 'tool'; toolName: string }",
          type: "object",
          description: "モデルに名前で特定のツールを使用することを要求します。"
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
    "ストリーミング中にエージェントが使用できる追加のツールセット。"
},
{
  name: "clientTools",
  type: "ToolsInput",
  isOptional: true,
  description:
    "リクエストの「クライアント」側で実行されるツール。これらのツールは定義に実行関数を持ちません。"
},
{
  name: "savePerStep",
  type: "boolean",
  isOptional: true,
  description:
    "各ストリームステップが完了した後にメッセージを段階的に保存します(デフォルト:false)。"
},
{
  name: "providerOptions",
  type: "Record<string, Record<string, JSONValue>>",
  isOptional: true,
  description:
    "基盤となるLLMプロバイダーに渡される追加のプロバイダー固有のオプション。構造は`{ providerName: { optionKey: value } }`です。例:`{ openai: { reasoningEffort: 'high' }, anthropic: { maxTokens: 1000 } }`。",
  properties: [
    {
      parameters: [
        {
          name: "openai",
          type: "Record<string, JSONValue>",
          isOptional: true,
          description:
            "OpenAI固有のオプション。例:`{ reasoningEffort: 'high' }`"
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
            "Anthropic固有のオプション。例:`{ maxTokens: 1000 }`"
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
            "Google固有のオプション。例: `{ safetySettings: [...] }`"
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
            "その他のプロバイダー固有のオプション。キーはプロバイダー名、値はプロバイダー固有のオプションのレコードです。"
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
    "この生成実行の一意のID。トラッキングとデバッグに役立ちます。"
},
{
  name: "runtimeContext",
  type: "RuntimeContext",
  isOptional: true,
  description:
    "依存性注入とコンテキスト情報のためのランタイムコンテキスト。"
},
{
  name: "maxTokens",
  type: "number",
  isOptional: true,
  description: "生成するトークンの最大数。"
},
{
  name: "topP",
  type: "number",
  isOptional: true,
  description:
    "ニュークリアスサンプリング。0から1の間の数値です。`temperature`または`topP`のいずれかを設定することを推奨しますが、両方を設定しないでください。"
},
{
  name: "topK",
  type: "number",
  isOptional: true,
  description:
    "後続の各トークンについて、上位K個のオプションからのみサンプリングします。低確率の「ロングテール」応答を除去するために使用されます。"
},
{
  name: "presencePenalty",
  type: "number",
  isOptional: true,
  description:
    "プレゼンスペナルティ設定。プロンプトに既に存在する情報をモデルが繰り返す可能性に影響します。-1(繰り返しを増加)から1(最大ペナルティ、繰り返しを減少)の間の数値です。"
},
{
  name: "frequencyPenalty",
  type: "number",
  isOptional: true,
  description:
    "頻度ペナルティ設定。モデルが同じ単語やフレーズを繰り返し使用する可能性に影響します。-1(繰り返しを増加)から1(最大ペナルティ、繰り返しを減少)の間の数値です。"
},
{
  name: "stopSequences",
  type: "string[]",
  isOptional: true,
  description:
    "停止シーケンス。設定されている場合、いずれかの停止シーケンスが生成されるとモデルはテキストの生成を停止します。"
},
{
  name: "seed",
  type: "number",
  isOptional: true,
  description:
    "ランダムサンプリングに使用するシード(整数)。設定されていてモデルがサポートしている場合、呼び出しは決定論的な結果を生成します。"
},
{
  name: "headers",
  type: "Record<string, string | undefined>",
  isOptional: true,
  description:
    "リクエストと共に送信される追加のHTTPヘッダー。HTTPベースのプロバイダーにのみ適用されます。"
}
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "textStream",
type: "AsyncGenerator<string>",
isOptional: true,
description:
"利用可能になり次第、テキストのチャンクを順次返す非同期ジェネレーター。",
},
{
name: "fullStream",
type: "Promise<ReadableStream>",
isOptional: true,
description:
"完全なレスポンスの ReadableStream に解決される Promise。",
},
{
name: "text",
type: "Promise<string>",
isOptional: true,
description:
"完全なテキストレスポンスに解決される Promise。",
},
{
name: "usage",
type: "Promise<{ totalTokens: number; promptTokens: number; completionTokens: number }>",
isOptional: true,
description:
"トークン使用量情報に解決される Promise。",
},
{
name: "finishReason",
type: "Promise<string>",
isOptional: true,
description:
"ストリームが終了した理由に解決される Promise。",
},
{
name: "toolCalls",
type: "Promise<Array<ToolCall>>",
isOptional: true,
description:
"ストリーミング中に行われたツール呼び出しに解決される Promise。",
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

## 応用例（拡張） \{#extended-usage-example\}

```typescript showLineNumbers copy
await agent.streamLegacy('エージェントへのメッセージ', {
  temperature: 0.7,
  maxSteps: 3,
  memory: {
    thread: 'user-123',
    resource: 'test-app',
  },
  toolChoice: 'auto',
});
```

## 新しい API への移行 \{#migration-to-new-api\}

:::note 非推奨のお知らせ

新しい `.stream()` メソッドは、AI SDK v5 への対応、構造化出力のより適切な扱い、改良されたコールバックシステムなど、機能が強化されています。詳しい移行手順は [移行ガイド](/docs/reference/agents/migration-guide) をご覧ください。

:::

### クイック移行の例 \{#quick-migration-example\}

#### 以前（レガシー） \{#before-legacy\}

```typescript
const result = await agent.streamLegacy('message', {
  temperature: 0.7,
  maxSteps: 3,
  onFinish: result => console.log(result),
});
```

#### 以後（新しいAPI） \{#after-new-api\}

```typescript
const result = await agent.stream('message', {
  modelSettings: {
    temperature: 0.7,
  },
  maxSteps: 3,
  onFinish: result => console.log(result),
});
```

## 関連項目 \{#related\}

* [移行ガイド](/docs/reference/agents/migration-guide)
* [新しい .stream() メソッド](./stream)
* [応答の生成](/docs/agents/overview#generating-responses)
* [応答のストリーミング](/docs/streaming/overview#streaming-with-agents)