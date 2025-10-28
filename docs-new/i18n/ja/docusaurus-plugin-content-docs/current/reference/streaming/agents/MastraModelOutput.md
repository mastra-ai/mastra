---
title: "MastraModelOutput（実験的）"
description: "MastraModelOutput の完全なリファレンス。agent.stream() が返すストリームオブジェクトで、モデル出力に対するストリーミングおよび Promise ベースのアクセスを提供します。"
---

# MastraModelOutput \{#mastramodeloutput\}

`MastraModelOutput` クラスは [.stream()](./stream) によって返され、モデル出力へのストリーミングアクセスと Promise ベースのアクセスの両方を提供します。構造化出力の生成、ツールの呼び出し、推論、および包括的な利用状況の追跡をサポートします。

```typescript
// MastraModelOutput は agent.stream() から返されます
const stream = await agent.stream('Hello world');
```

セットアップと基本的な使用方法については、[.stream()](./stream) メソッドのドキュメントを参照してください。

## ストリーミングのプロパティ \{#streaming-properties\}

これらのプロパティにより、生成中のモデル出力へリアルタイムでアクセスできます:

<PropertiesTable
  content={[
{
name: "fullStream",
type: "ReadableStream<ChunkType<OUTPUT>>",
description: "テキスト、ツール呼び出し、推論、メタデータ、制御チャンクを含む、すべてのチャンク種別の完全なストリーム。モデルの応答のあらゆる側面にきめ細かくアクセスできます。",
properties: [{
type: "ReadableStream",
parameters: [
{ name: "ChunkType", type: "ChunkType<OUTPUT>", description: "ストリーミング中に出力され得るすべてのチャンク種別" }
]
}]
},
{
name: "textStream",
type: "ReadableStream<string>",
description: "テキストのみを段階的に出力するストリーム。メタデータ、ツール呼び出し、制御チャンクをすべて除外し、生成中のテキストだけを提供します。"
},
{
name: "objectStream",
type: "ReadableStream<PartialSchemaOutput<OUTPUT>>",
description: "出力スキーマ使用時の、構造化オブジェクトの段階的な更新ストリーム。部分オブジェクトを組み立てながら逐次出力し、構造化データ生成をリアルタイムで可視化できます。",
properties: [{
type: "ReadableStream",
parameters: [
{ name: "PartialSchemaOutput", type: "PartialSchemaOutput<OUTPUT>", description: "定義済みスキーマに適合する未完成の部分オブジェクト" }
]
}]
},
{
name: "elementStream",
type: "ReadableStream<InferSchemaOutput<OUTPUT> extends (infer T)[] ? T : never>",
description: "出力スキーマが配列型を定義している場合の、個々の配列要素のストリーム。配列全体の完了を待たず、各要素が完成し次第出力されます。"
}
]}
/>

## Promiseベースのプロパティ \{#promise-based-properties\}

これらのプロパティは、ストリーム完了後に最終的な値へと解決されます:

<PropertiesTable
  content={[
{
name: "text",
type: "Promise<string>",
description: "モデルからの結合済みの完全なテキスト応答。テキスト生成が完了すると解決されます。"
},
{
name: "object",
type: "Promise<InferSchemaOutput<OUTPUT>>",
description: "出力スキーマを使用している場合の、完全な構造化オブジェクトの応答。解決前にスキーマで検証され、検証に失敗した場合は拒否されます。",
properties: [{
type: "Promise",
parameters: [
{ name: "InferSchemaOutput", type: "InferSchemaOutput<OUTPUT>", description: "スキーマ定義に厳密に一致する、完全に型付けされたオブジェクト" }
]
}]
},
{
name: "reasoning",
type: "Promise<string>",
description: "reasoning をサポートするモデル（OpenAI の o1 シリーズなど）向けの完全な reasoning テキスト。reasoning 機能のないモデルでは空文字列を返します。"
},
{
name: "reasoningText",
type: "Promise<string | undefined>",
description: "reasoning コンテンツへの別経路。reasoning をサポートしないモデルでは undefined になる場合がありますが、'reasoning' は空文字列を返します。"
},
{
name: "toolCalls",
type: "Promise<ToolCallChunk[]>",
description: "実行中に行われたすべてのツール呼び出しチャンクの配列。各チャンクにはツールのメタデータと実行の詳細が含まれます。",
properties: [{
type: "ToolCallChunk",
parameters: [
{ name: "type", type: "'tool-call'", description: "チャンク種別識別子" },
{ name: "runId", type: "string", description: "実行ラン識別子" },
{ name: "from", type: "ChunkFrom", description: "チャンクの送出元（AGENT、WORKFLOW など）" },
{ name: "payload", type: "ToolCallPayload", description: "toolCallId、toolName、args、実行の詳細を含むツール呼び出しデータ" }
]
}]
},
{
name: "toolResults",
type: "Promise<ToolResultChunk[]>",
description: "ツール呼び出しに対応するすべてのツール結果チャンクの配列。実行結果およびエラー情報を含みます。",
properties: [{
type: "ToolResultChunk",
parameters: [
{ name: "type", type: "'tool-result'", description: "チャンク種別識別子" },
{ name: "runId", type: "string", description: "実行ラン識別子" },
{ name: "from", type: "ChunkFrom", description: "チャンクの送出元（AGENT、WORKFLOW など）" },
{ name: "payload", type: "ToolResultPayload", description: "toolCallId、toolName、result、エラー状態を含むツール結果データ" }
]
}]
},
{
name: "usage",
type: "Promise<LanguageModelUsage>",
description: "トークン使用統計（入力トークン、出力トークン、合計トークン、reasoning モデルの場合は reasoning トークン）を含みます。",
properties: [{
type: "Record",
parameters: [
{ name: "inputTokens", type: "number", description: "入力プロンプトで消費されたトークン数" },
{ name: "outputTokens", type: "number", description: "応答で生成されたトークン数" },
{ name: "totalTokens", type: "number", description: "入力トークンと出力トークンの合計" },
{ name: "reasoningTokens", type: "number", isOptional: true, description: "非表示の reasoning トークン（reasoning モデル向け）" },
{ name: "cachedInputTokens", type: "number", isOptional: true, description: "キャッシュヒットとなった入力トークン数" }
]
}]
},
{
name: "finishReason",
type: "Promise<string | undefined>",
description: "生成が停止した理由（例: 'stop'、'length'、'tool_calls'、'content_filter'）。ストリームが終了していない場合は undefined です。",
properties: [{
type: "enum",
parameters: [
{ name: "stop", type: "'stop'", description: "モデルが自然に終了" },
{ name: "length", type: "'length'", description: "最大トークン数に到達" },
{ name: "tool_calls", type: "'tool_calls'", description: "モデルがツールを呼び出した" },
{ name: "content_filter", type: "'content_filter'", description: "コンテンツがフィルタリングされた" }
]
}]
}
]}
/>

## エラーのプロパティ \{#error-properties\}

<PropertiesTable
  content={[
{
name: "error",
type: "string | Error | { message: string; stack: string; } | undefined",
description: "ストリームでエラーが発生した場合のエラー情報。エラーがなかった場合は undefined。文字列メッセージ、Error オブジェクト、またはスタックトレースを含むシリアライズ済みエラーのいずれか。"
}
]}
/>

## メソッド \{#methods\}

<PropertiesTable
  content={[
{
name: "getFullOutput",
type: "() => Promise<FullOutput>",
description: "テキスト、構造化オブジェクト、ツール呼び出し、使用統計、推論、メタデータなど、すべての結果を含む包括的な出力オブジェクトを返します。ストリームの全結果にアクセスできる便利な単一のメソッドです。",
properties: [{
type: "FullOutput",
parameters: [
{ name: "text", type: "string", description: "完全なテキスト応答" },
{ name: "object", type: "InferSchemaOutput<OUTPUT>", isOptional: true, description: "スキーマが指定されている場合の構造化出力" },
{ name: "toolCalls", type: "ToolCallChunk[]", description: "行われたすべてのツール呼び出しチャンク" },
{ name: "toolResults", type: "ToolResultChunk[]", description: "すべてのツール結果チャンク" },
{ name: "usage", type: "Record<string, number>", description: "トークン使用量の統計" },
{ name: "reasoning", type: "string", isOptional: true, description: "利用可能な場合の推論テキスト" },
{ name: "finishReason", type: "string", isOptional: true, description: "生成が終了した理由" }
]
}]
},
{
name: "consumeStream",
type: "(options?: ConsumeStreamOptions) => Promise<void>",
description: "チャンクを処理せずにストリーム全体を手動で消費します。最終的なPromiseベースの結果だけが必要で、ストリームの消費を明示的に開始したい場合に有用です。",
properties: [{
type: "ConsumeStreamOptions",
parameters: [
{ name: "onError", type: "(error: Error) => void", isOptional: true, description: "ストリームエラーを処理するコールバック" }
]
}]
}
]}
/>

## 使い方の例 \{#usage-examples\}

### 基本のテキストストリーミング \{#basic-text-streaming\}

```typescript
const stream = await agent.stream('俳句を書いて')

// 生成されるそばからテキストをストリーミングする
for await (const text of stream.textStream) {
  process.stdout.write(text);
}

// あるいは全文を取得する
const fullText = await stream.text;
console.log(fullText);
```

### 構造化出力のストリーミング \{#structured-output-streaming\}

```typescript
const stream = await agent.stream('ユーザー データを生成', {
  structuredOutput: {
    schema: z.object({
      name: z.string(),
      age: z.number(),
      email: z.string(),
    }),
  },
  maxSteps: 1,
});

// 部分的なオブジェクトをストリーミング
for await (const partial of stream.objectStream) {
  console.log('進行状況:', partial); // { name: "John" }, { name: "John", age: 30 }, ...
}

// 最終的な検証済みオブジェクトを取得
const user = await stream.object;
console.log('最終:', user); // { name: "John", age: 30, email: "john@example.com" }
```

````

### ツール呼び出しと結果

```typescript
const stream = await agent.stream("NYCの天気は？", {
  tools: { weather: weatherTool }
});

// ツール呼び出しを監視
const toolCalls = await stream.toolCalls;
const toolResults = await stream.toolResults;

console.log("呼び出したツール:", toolCalls);
console.log("結果:", toolResults);
````

### 出力全体へのアクセス \{#complete-output-access\}

```typescript
const stream = await agent.stream('このデータを分析して');

const output = await stream.getFullOutput();
console.log({
  text: output.text,
  usage: output.usage,
  reasoning: output.reasoning,
  finishReason: output.finishReason,
});
```

### フルストリーム・プロセッシング \{#full-stream-processing\}

```typescript
const stream = await agent.stream('複雑なタスク');

for await (const chunk of stream.fullStream) {
  switch (chunk.type) {
    case 'text-delta':
      process.stdout.write(chunk.payload.text);
      break;
    case 'tool-call':
      console.log(`${chunk.payload.toolName} を呼び出しています...`);
      break;
    case 'reasoning-delta':
      console.log(`推論: ${chunk.payload.text}`);
      break;
    case 'finish':
      console.log(`完了！理由: ${chunk.payload.stepResult.reason}`);
      break;
  }
}
```

### エラーハンドリング \{#error-handling\}

```typescript
const stream = await agent.stream('このデータを分析');

try {
  // オプション1: consumeStreamでエラーを処理
  await stream.consumeStream({
    onError: error => {
      console.error('ストリームエラー:', error);
    },
  });

  const result = await stream.text;
} catch (error) {
  console.error('結果の取得に失敗しました:', error);
}

// オプション2: errorプロパティを確認
const result = await stream.getFullOutput();
if (stream.error) {
  console.error('ストリームにエラーがありました:', stream.error);
}
```

## 関連型 \{#related-types\}

* [.stream()](./stream) - MastraModelOutput を返すメソッド
* [ChunkType](../ChunkType) - ストリーム全体で使用される可能性のあるすべてのチャンク型