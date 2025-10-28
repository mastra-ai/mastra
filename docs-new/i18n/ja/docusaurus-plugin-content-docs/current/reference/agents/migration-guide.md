# 移行ガイド: VNext から標準 API への移行 \{#migration-guide-vnext-to-standard-apis\}

## 概要 \{#overview\}

`v 0.20.00` 時点で、Mastra エージェントの `streamVNext()` と `generateVNext()` メソッドは、それぞれ `stream()` と `generate()` に改名されました。これらは現在、AI SDK v5 に完全対応した標準 API です。従来の `stream()` と `generate()` メソッドは、AI SDK v4 との後方互換性を維持するために `streamLegacy()` と `generateLegacy()` に改名されています。

### AI SDK v4 モデルを引き続き使用する \{#continue-using-ai-sdk-v4-models\}

* すべての `stream()` と `generate()` の呼び出しを、それぞれ `streamLegacy()` と `generateLegacy()` にリネームしてください。その他の変更は不要です。

### AI SDK v5 モデルを引き続き利用する \{#continue-using-ai-sdk-v5-models\}

* すべての `streamVNext()` と `generateVNext()` の呼び出しを、それぞれ `stream()` と `generate()` にリネームしてください。その他の変更は不要です。

### AI SDK v4 のモデルから v5 のモデルへのアップグレード \{#upgrade-from-ai-sdk-v4-models-to-v5-models\}

まず、すべてのモデルプロバイダーのパッケージをメジャーバージョンに上げてください。これにより、すべてが v5 モデルになります。違いを理解するために、以下のガイドをご参照ください。

## 主な違い \{#key-differences\}

### 1. モデルバージョンのサポート \{#1-model-version-support\}

* **レガシー API（`generateLegacy`、`streamLegacy`）**: AI SDK v4 のモデル（specificationVersion: &#39;v1&#39;）のみをサポート
* **現行 API（`generate`、`stream`）**: AI SDK v5 のモデル（specificationVersion: &#39;v2&#39;）のみをサポート
* 実行時に明確なエラーメッセージとともに検証されます

### 2. 返り値の型 \{#2-return-types\}

#### レガシー方式のメソッドは AI SDK v4 の型を返します \{#legacy-methods-return-ai-sdk-v4-types\}

* **`generateLegacy()`**:
  * `GenerateTextResult` または `GenerateObjectResult`

* **`streamLegacy()`**:
  * `StreamTextResult` または `StreamObjectResult`

#### 新しいストリームメソッドは Mastra/AI SDK v5 の型を返します \{#new-stream-methods-return-mastraai-sdk-v5-types\}

* **`generate()`**:
  * `format: 'mastra'`（デフォルト）の場合: `MastraModelOutput.getFullOutput()` の結果を返す
  * `format: 'aisdk'` の場合: `AISDKV5OutputStream.getFullOutput()` の結果を返す（AI SDK v5 互換）
  * 内部で `stream()` を呼び出し、`getFullOutput()` の完了を待機する

* **`stream()`**:
  * `format: 'mastra'`（デフォルト）の場合: `MastraModelOutput<OUTPUT>` を返す
  * `format: 'aisdk'` の場合: `AISDKV5OutputStream<OUTPUT>` を返す（AI SDK v5 互換）

#### フォーマット制御 \{#format-control\}

* **Legacy**: フォーマット制御なし。常に AI SDK v4 の型を返す
* **New stream**: `format` オプション（&#39;mastra&#39; または &#39;aisdk&#39;）でフォーマットを選択可能

```typescript
// Mastra ネイティブ形式（デフォルト）
const result = await agent.stream(messages, {
  format: 'mastra',
});

// AI SDK v5 との互換性
const result = await agent.stream(messages, {
  format: 'aisdk',
});
```

### 3. 非レガシーAPIの新オプション \{#3-new-options-in-non-legacy-apis\}

次のオプションは `stream()` と `generate()` で利用できますが、レガシー版では利用できません:

1. **`format`** - 出力形式を &#39;mastra&#39; または &#39;aisdk&#39; から選択

```typescript
const result = await agent.stream(messages, {
  format: 'aisdk', // または 'mastra' (デフォルト)
});
```

2. **`system`** - カスタムの system メッセージ（instructions とは別）

```typescript
const result = await agent.stream(messages, {
  system: 'あなたは親切なアシスタントです',
});
```

3. **`structuredOutput`** - モデルの上書きとカスタムオプションによる強化された構造化出力

* モデルが指定されていない場合、エージェントのデフォルトモデルが使用されます。
* オブジェクトがスキーマに準拠しない場合のエラー戦略は、`warn`（警告をログ出力）、`error`（エラーを送出）、`fallback`（任意のデフォルトのフォールバック値を返す）のいずれかです。

```typescript
const result = await agent.generate(messages, {
  structuredOutput: {
    schema: z.object({
      name: z.string(),
      age: z.number(),
    }),
    model: openai('gpt-4o-mini'), // 構造化のためのモデルの任意指定（オーバーライド）
    errorStrategy: 'fallback',
    fallbackValue: { name: 'unknown', age: 0 },
    instructions: 'ユーザー情報を抽出', // 既定の構造化用指示をオーバーライド
  },
});
```

4. **`stopWhen`** - 柔軟な停止条件（ステップ数、トークン数の上限など）

```typescript
const result = await agent.stream(messages, {
  stopWhen: ({ steps, totalTokens }) => steps >= 5 || totalTokens >= 10000,
});
```

5. **`providerOptions`** - プロバイダ固有のオプション（例：OpenAI 固有の設定）

```typescript
const result = await agent.stream(messages, {
  providerOptions: {
    openai: {
      store: true,
      metadata: { userId: '123' },
    },
  },
});
```

6. **`onChunk`** - ストリーミング中の各チャンクに呼び出されるコールバック

```typescript
const result = await agent.stream(messages, {
  onChunk: chunk => {
    console.log('チャンクを受け取りました:', chunk);
  },
});
```

7. **`onError`** - エラー時のコールバック関数

```typescript
const result = await agent.stream(messages, {
  onError: error => {
    console.error('ストリームエラー:', error);
  },
});
```

8. **`onAbort`** - 中断時のコールバック

```typescript
const result = await agent.stream(messages, {
  onAbort: () => {
    console.log('ストリームが中断されました');
  },
});
```

9. **`activeTools`** - この実行でアクティブにするツールを指定します

```typescript
const result = await agent.stream(messages, {
  activeTools: ['search', 'calculator'], // 利用可能なのはこれらのツールのみ
});
```

10. **`abortSignal`** - キャンセル用の AbortSignal

```typescript
const controller = new AbortController();
const result = await agent.stream(messages, {
  abortSignal: controller.signal,
});

// 後で実行: controller.abort();
```

11. **`prepareStep`** - マルチステップ実行で各ステップの前に呼び出されるコールバック

```typescript
const result = await agent.stream(messages, {
  prepareStep: ({ step, state }) => {
    console.log('ステップの実行直前:', step);
    return {
      /* 変更後の状態 */
    };
  },
});
```

12. **`requireToolApproval`** - すべてのツール呼び出しに対して承認を必須とする

```typescript
const result = await agent.stream(messages, {
  requireToolApproval: true,
});
```

### 4. まだ存在するが移動されたオプション \{#4-options-that-still-exist-but-have-been-moved\}

#### `temperature` とその他のモデル設定 \{#temperature-and-other-model-settings\}

`modelSettings` に統合されました

```typescript
const result = await agent.stream(messages, {
  modelSettings: {
    temperature: 0.7,
    maxTokens: 1000,
    topP: 0.9,
  },
});
```

#### `resourceId` と `threadId` \{#resourceid-and-threadid\}

メモリオブジェクトへ移動されました。

```typescript
const result = await agent.stream(messages, {
  memory: {
    resource: 'user-123',
    thread: 'thread-456',
  },
});
```

### 5. 非推奨または廃止されたオプション \{#5-options-that-are-deprecated-or-removed\}

#### `experimental_output` \{#experimental&#95;output\}

ツール呼び出しとオブジェクトの返却を可能にするため、代わりに `structuredOutput` を使用してください。

```typescript
const result = await agent.generate(messages, {
  structuredOutput: {
    schema: z.object({
      summary: z.string(),
    }),
  },
});
```

#### `output` \{#output\}

`output` プロパティは非推奨です。代わりに `structuredOutput` を使用してください。同等の結果を得るには、`structuredOutput` と `maxSteps` を 1 に設定して使用します。

```typescript
const result = await agent.generate(messages, {
  structuredOutput: {
    schema: {
      z.object({
        name: z.string()
      })
    }
  },
  maxSteps: 1
});
```

#### `memoryOptions` は削除されました \{#memoryoptions-was-removed\}

代わりに `memory` を使用してください

```typescript
const result = await agent.generate(messages, {
  memory: {
    ...
  }
});
```

### 6. 型の変更 \{#6-type-changes\}

#### `context` \{#context\}

* **旧形式**: `CoreMessage[]`
* **新形式**: `ModelMessage[]`

#### `toolChoice` は AI SDK v5 の `ToolChoice` 型を使います \{#toolchoice-uses-the-ai-sdk-v5-toolchoice-type\}

```typescript
type ToolChoice<TOOLS extends Record<string, unknown>> =
  | 'auto'
  | 'none'
  | 'required'
  | {
      type: 'tool';
      toolName: Extract<keyof TOOLS, string>;
    };
```

## 移行用チェックリスト \{#migration-checklist\}

### すでに `streamVNext` と `generateVNext` を使用している場合 \{#if-youre-already-using-streamvnext-and-generatevnext\}

それぞれのメソッド名を `stream` と `generate` に検索して置換するだけです。

### 旧バージョンの `stream` と `generate` を使用している場合 \{#if-youre-using-the-old-stream-and-generate\}

アップグレードするかどうかを決めてください。アップグレードしない場合は、`streamLegacy` と `generateLegacy` に検索置換してください。