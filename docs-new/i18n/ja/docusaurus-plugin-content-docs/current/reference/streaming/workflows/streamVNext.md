---
title: "Run.streamVNext()"
description: ワークフローにおける `Run.streamVNext()` メソッドのドキュメント。応答をリアルタイムでストリーミングできます。
---

# Run.streamVNext()（実験的） \{#runstreamvnext-experimental\}

:::caution 実験的

この機能は実験的であり、APIは将来のリリースで変更される可能性があります。

:::

`.streamVNext()` メソッドは、ワークフローからの応答をリアルタイムでストリーミングすることを可能にします。この拡張されたストリーミング機能は、将来的に現在の `stream()` メソッドに置き換わる予定です。

## 使い方の例 \{#usage-example\}

```typescript showLineNumbers copy
const run = await workflow.createRunAsync();

const stream = run.streamVNext({
  inputData: {
    value: '初期値',
  },
});
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "inputData",
type: "z.infer<TInput>",
description: "ワークフローの入力スキーマに適合する入力データ。",
isOptional: true,
},
{
name: "runtimeContext",
type: "RuntimeContext",
description: "ワークフロー実行時に使用するランタイムコンテキストデータ。",
isOptional: true,
},
{
name: "tracingContext",
type: "TracingContext",
isOptional: true,
description: "子スパンの作成やメタデータの追加に使う AI トレーシングコンテキスト。",
properties: [
{
parameters: [{
name: "currentSpan",
type: "AISpan",
isOptional: true,
description: "子スパンの作成やメタデータの追加に使う現在の AI スパン。"
}]
}
]
},
{
name: "tracingOptions",
type: "TracingOptions",
isOptional: true,
description: "AI トレーシングの設定オプション。",
properties: [
{
parameters: [{
name: "metadata",
type: "Record<string, any>",
isOptional: true,
description: "ルートトレーススパンに追加するメタデータ。"
}]
}
]
},
{
name: "closeOnSuspend",
type: "boolean",
description: "ワークフローが一時停止された際にストリームを閉じるか、ワークフローが（成功またはエラーで）完了するまで開いたままにするかを指定します。既定値は true。",
isOptional: true,
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "stream",
type: "MastraWorkflowStream<ChunkType>",
description: "ReadableStream<ChunkType> を拡張し、ワークフロー固有のプロパティを追加したカスタムストリーム",
},
{
name: "stream.status",
type: "Promise<RunStatus>",
description: "現在のワークフロー実行ステータスを返す Promise",
},
{
name: "stream.result",
type: "Promise<WorkflowResult<TState, TOutput, TSteps>>",
description: "最終的なワークフロー結果を返す Promise",
},
{
name: "stream.usage",
type: "Promise<{ inputTokens: number; outputTokens: number; totalTokens: number, reasoningTokens?: number, cacheInputTokens?: number }>",
description: "トークン使用状況の統計情報を返す Promise",
},
{
name: "stream.traceId",
type: "string",
isOptional: true,
description: "AI トレーシングが有効な場合、この実行に関連付けられるトレース ID",
},
]}
/>

## 追加の使用例 \{#extended-usage-example\}

```typescript showLineNumbers copy
const run = await workflow.createRunAsync();

const stream = run.streamVNext({
  inputData: {
    value: '初期値',
  },
});

const result = await stream.result;
```

## ストリームイベント \{#stream-events\}

ストリームはワークフローの実行中にさまざまな種類のイベントを発行します。各イベントには `type` フィールドと、関連データを含む `payload` が含まれます:

* **`workflow-start`**: ワークフローの実行が開始される
* **`workflow-step-start`**: ステップの実行が開始される
* **`workflow-step-output`**: ステップからのカスタム出力
* **`workflow-step-result`**: ステップが結果とともに完了する
* **`workflow-finish`**: 利用状況の統計情報とともにワークフローの実行が完了する

## 関連項目 \{#related\}

* [Workflows の概要](/docs/workflows/overview#testing-workflows-locally)
* [Workflow.createRunAsync()](../../../reference/workflows/workflow-methods/create-run)
* [Run.resumeStreamVNext()](./resumeStreamVNext)