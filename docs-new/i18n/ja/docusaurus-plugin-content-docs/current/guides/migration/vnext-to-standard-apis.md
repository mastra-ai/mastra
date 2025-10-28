---
title: "VNext から標準 API へ"
description: "Mastra の VNext メソッドから新しい標準エージェント API への移行方法を学びましょう。"
---

## 概要 \{#overview\}

`v0.20.0` 時点では、以下の変更が適用されています。

## レガシーAPI（AI SDK v4） \{#legacy-apis-ai-sdk-v4\}

元のメソッドは名称が変更され、**AI SDK v4** および `v1` モデルとの後方互換性が維持されています。

* `.stream()` → `.streamLegacy()`
* `.generate()` → `.generateLegacy()`

## 標準 API（AI SDK v5） \{#standard-apis-ai-sdk-v5\}

以下は、**AI SDK v5** と `v2` モデルに完全対応している現行の API です。

* `.streamVNext()` → `.stream()`
* `.generateVNext()` → `.generate()`

## 移行パス \{#migration-paths\}

すでに `.streamVNext()` と `.generateVNext()` を使用している場合は、検索と置換でそれぞれメソッドを `.stream()` と `.generate()` に変更してください。

古い `.stream()` と `.generate()` を使用している場合は、アップグレードするかどうかを検討してください。アップグレードしない場合は、検索と置換で `.streamLegacy()` と `.generateLegacy()` に変更してください。

ニーズに合った移行パスを選択してください。

### AI SDK v4 のモデルを引き続き使用する \{#keep-using-ai-sdk-v4-models\}

* すべての `.stream()` および `.generate()` の呼び出しを、それぞれ `.streamLegacy()` および `.generateLegacy()` に変更してください。

> そのほかの変更は不要です。

### AI SDK v5 のモデルを引き続き使用する \{#keep-using-ai-sdk-v5-models\}

* すべての `.streamVNext()` と `.generateVNext()` の呼び出しを、それぞれ `.stream()` と `.generate()` に変更します。

> それ以外の変更は不要です。

### AI SDK v4 から v5 へアップグレード \{#upgrade-from-ai-sdk-v4-to-v5\}

* すべてのモデルプロバイダーのパッケージをメジャーバージョンに上げてください。

> これにより、すべてが v5 のモデルになります。以下のガイドで主な違いを確認し、それに合わせてコードを更新してください。

## 重要な相違点 \{#key-differences\}

更新された `.stream()` と `.generate()` メソッドは、従来版と比べて挙動、互換性、戻り値の型、利用可能なオプションが異なります。このセクションでは、移行の際に理解しておくべき重要な変更点を取り上げます。

### 1. モデルバージョンのサポート \{#1-model-version-support\}

**レガシー API**

* `.generateLegacy()`
* `.streamLegacy()`

**AI SDK v4** のモデル（`specificationVersion: 'v1'`）のみ対応

**標準 API**

* `.generate()`
* `.stream()`

**AI SDK v5** のモデル（`specificationVersion: 'v2'`）のみ対応

> これは実行時に明確なエラーメッセージとともに強制されます。

### 2. 戻り値の型 \{#2-return-types\}

**レガシー API**

* `.generateLegacy()`
  戻り値: `GenerateTextResult` または `GenerateObjectResult`

* `.streamLegacy()`
  戻り値: `StreamTextResult` または `StreamObjectResult`

詳しくは次の API リファレンスを参照してください:

* [Agent.generateLegacy()](/docs/reference/agents/generateLegacy)
* [Agent.streamLegacy()](/docs/reference/streaming/agents/streamLegacy)

**標準 API**

* `.generate()`
  * `format: 'mastra'`（デフォルト）: 戻り値 `MastraModelOutput.getFullOutput()`
  * `format: 'aisdk'`: 戻り値 `AISDKV5OutputStream.getFullOutput()`
  * 内部的に `.stream()` を呼び出し、`.getFullOutput()` の完了を待機します

* `.stream()`
  * `format: 'mastra'`（デフォルト）: 戻り値 `MastraModelOutput<OUTPUT>`
  * `format: 'aisdk'`: 戻り値 `AISDKV5OutputStream<OUTPUT>`

詳しくは次の API リファレンスを参照してください:

* [Agent.generate()](/docs/reference/agents/generate)
* [Agent.stream()](/docs/reference/streaming/agents/stream)

### 3. フォーマット制御 \{#3-format-control\}

**レガシー API**

* `format` オプションなし: 常に AI SDK v4 の型を返す

```typescript showLineNumbers copy
// Mastra のネイティブ形式（デフォルト）
const result = await agent.stream(messages);
```

**標準 API**

* 出力形式は `format` オプションで選択します:
  * `'mastra'`（デフォルト）
  * `'aisdk'`（AI SDK v5 互換）

```typescript showLineNumbers copy
// AI SDK v5 互換性
const result = await agent.stream(messages, {
  format: 'aisdk',
});
```

### 4. 標準 API の新しいオプション \{#4-new-options-in-standard-apis\}

次のオプションは標準の `.stream()` および `generate()` で利用できますが、レガシー版では利用できません：

* `format` - 出力形式を &#39;mastra&#39; または &#39;aisdk&#39; から選択します：

```typescript showLineNumbers copy
const result = await agent.stream(messages, {
  format: 'aisdk', // または 'mastra'（デフォルト）
});
```

* `system` - カスタムのシステムメッセージ（指示とは別）。

```typescript showLineNumbers copy
const result = await agent.stream(messages, {
  system: 'あなたは親切なアシスタントです',
});
```

* `structuredOutput` - モデルの上書きやカスタムオプションに対応した拡張版の構造化出力。
  * `jsonPromptInjection` - `response_format` をモデルに渡すデフォルトの挙動を上書きするために使用します。プロンプトにコンテキストを注入し、モデルに構造化出力を返すよう促します。
  * `model` - モデルを指定すると、メインエージェントの応答を構造化するサブエージェントを作成します。メインエージェントはツールを呼び出してテキストを返し、サブエージェントは指定したスキーマに準拠するオブジェクトを返します。これは `experimental_output` の代替です。
  * `errorStrategy` - 出力がスキーマに一致しない場合の挙動を指定します:
    * &#39;warn&#39; - 警告をログ出力
    * &#39;error&#39; - エラーをスロー
    * &#39;fallback&#39; - 指定したフォールバック値を返す

```typescript showLineNumbers copy
const result = await agent.generate(messages, {
  structuredOutput: {
    schema: z.object({
      name: z.string(),
      age: z.number(),
    }),
    model: 'openai/gpt-4o-mini', // 構造化用の任意のモデル指定の上書き
    errorStrategy: 'fallback',
    fallbackValue: { name: 'unknown', age: 0 },
    instructions: 'ユーザー情報を抽出', // 既定の構造化用指示を上書き
  },
});
```

* `stopWhen` - 柔軟な停止条件（ステップ数、トークン数の上限など）。

```typescript showLineNumbers copy
const result = await agent.stream(messages, {
  stopWhen: ({ steps, totalTokens }) => steps >= 5 || totalTokens >= 10000,
});
```

* `providerOptions` - プロバイダー固有のオプション（例：OpenAI 固有の設定）

```typescript showLineNumbers copy
const result = await agent.stream(messages, {
  providerOptions: {
    openai: {
      store: true,
      metadata: { userId: '123' },
    },
  },
});
```

* `onChunk` - ストリーミングの各チャンクに対するコールバック。

```typescript showLineNumbers copy
const result = await agent.stream(messages, {
  onChunk: chunk => {
    console.log('チャンクを受信:', chunk);
  },
});
```

* `onError` - エラー時に呼び出されるコールバック。

```typescript showLineNumbers copy
const result = await agent.stream(messages, {
  onError: error => {
    console.error('ストリームエラー:', error);
  },
});
```

* `onAbort` - 中断時に呼び出されるコールバック。

```typescript showLineNumbers copy
const result = await agent.stream(messages, {
  onAbort: () => {
    console.log('ストリームを中断しました');
  },
});
```

* `activeTools` - この実行でアクティブにするツールを指定します。

```typescript showLineNumbers copy
const result = await agent.stream(messages, {
  activeTools: ['search', 'calculator'], // この実行ではこれらのツールのみが使用可能です
});
```

* `abortSignal` - キャンセルのための AbortSignal。

```typescript showLineNumbers copy
const controller = new AbortController();
const result = await agent.stream(messages, {
  abortSignal: controller.signal,
});

// 後で実行: controller.abort();
```

* `prepareStep` - マルチステップ実行で、各ステップの前に呼び出されるコールバック。

```typescript showLineNumbers copy
const result = await agent.stream(messages, {
  prepareStep: ({ step, state }) => {
    console.log('これからステップを実行します:', step);
    return {
      /* 変更後のステート */
    };
  },
});
```

* `requireToolApproval` - すべてのツール呼び出しに対して承認を必須にします。

```typescript showLineNumbers copy
const result = await agent.stream(messages, {
  すべてのツール呼び出しに承認が必要: true,
});
```

### 5. 移行されたレガシーオプション \{#5-legacy-options-that-moved\}

* `temperature` とその他の `modelSettings`

`modelSettings` に統合されました

```typescript showLineNumbers copy
const result = await agent.stream(messages, {
  modelSettings: {
    temperature: 0.7,
    maxTokens: 1000,
    topP: 0.9,
  },
});
```

* `resourceId` と `threadId`。
  メモリオブジェクトへ移動しました。

```typescript showLineNumbers copy
const result = await agent.stream(messages, {
  memory: {
    resource: 'user-123',
    thread: 'thread-456',
  },
});
```

### 6. 非推奨または削除されたオプション \{#6-deprecated-or-removed-options\}

* `experimental_output`

ツール呼び出しとオブジェクトの返却を可能にするため、代わりに `structuredOutput` を使用してください。

```typescript showLineNumbers copy
const result = await agent.generate(messages, {
  structuredOutput: {
    schema: z.object({
      summary: z.string(),
    }),
    model: 'openai/gpt-4o',
  },
});
```

* `output`

`output` プロパティは非推奨となり、代わりに `structuredOutput` を使用してください。同じ結果を得るには、model を指定せず、`structuredOutput.schema` のみを渡します。さらに、使用中の model が `response_format` をネイティブにサポートしていない場合は、必要に応じて `jsonPromptInjection: true` を追加してください。

```typescript showLineNumbers copy
const result = await agent.generate(messages, {
  structuredOutput: {
    schema: {
      z.object({
        name: z.string()
      })
    }
  },
});
```

* `memoryOptions`

`memory` を使用してください。

```typescript showLineNumbers copy
const result = await agent.generate(messages, {
  memory: {
    // ...
  },
});
```

### 7. 型の変更 \{#7-type-changes\}

**レガシー API**

* `CoreMessage[]`

詳細は次の API リファレンスをご参照ください：

* [Agent.generateLegacy()](/docs/reference/agents/generateLegacy)
* [Agent.streamLegacy()](/docs/reference/streaming/agents/streamLegacy)

**標準 API**

* `ModelMessage[]`

`toolChoice` は AI SDK v5 の `ToolChoice` 型を使用します。

```typescript showLineNumbers copy
type ToolChoice<TOOLS extends Record<string, unknown>> =
  | 'auto'
  | 'none'
  | 'required'
  | {
      type: 'tool';
      toolName: Extract<keyof TOOLS, string>;
    };
```

詳しくは、以下の API リファレンスをご覧ください。

* [Agent.generate()](/docs/reference/agents/generate)
* [Agent.stream()](/docs/reference/streaming/agents/stream)
