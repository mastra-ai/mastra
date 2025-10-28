---
title: "Run.stream() "
description: ワークフローで実行中のランをストリームとして監視できる、`Run.stream()` メソッドのドキュメントです。
---

# Run.stream() \{#runstream\}

`.stream()` メソッドを使うと、ワークフロー実行を監視し、各ステップの進行状況をリアルタイムで確認できます。

## 使い方の例 \{#usage-example\}

```typescript showLineNumbers copy
const run = await workflow.createRunAsync();

const { stream } = await run.stream({
  inputData: {
    value: '初期データ',
  },
});
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "inputData",
type: "z.infer<TInput>",
description: "ワークフローの入力スキーマに適合する入力データ",
isOptional: true,
},
{
name: "runtimeContext",
type: "RuntimeContext",
description: "ワークフロー実行時に使用するランタイムコンテキストデータ",
isOptional: true,
},
{
name: "tracingContext",
type: "TracingContext",
isOptional: true,
description: "子スパンの作成やメタデータ追加のための AI トレーシング用コンテキスト。Mastra のトレーシングシステム使用時は自動で注入されます。",
properties: [
{
parameters: [{
name: "currentSpan",
type: "AISpan",
isOptional: true,
description: "子スパンの作成やメタデータ追加に用いる現在の AI スパン。これを使ってカスタムの子スパンを作成したり、実行中にスパン属性を更新できます。"
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
description: "ルートトレーススパンに付与するメタデータ。ユーザー ID、セッション ID、フィーチャーフラグなどのカスタム属性を追加する際に便利です。"
}]
}
]
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "stream",
type: "ReadableStream<StreamEvent>",
description: "ワークフローの実行イベントをリアルタイムで送出する読み取り可能なストリーム",
},
{
name: "getWorkflowState",
type: "() => Promise<WorkflowResult<TState, TOutput, TSteps>>",
description: "最終的なワークフロー結果に解決される Promise を返す関数",
},
{
name: "traceId",
type: "string",
isOptional: true,
description: "AI トレーシングが有効な場合、この実行に関連付けられるトレース ID。ログの紐付けや実行フローのデバッグに使用します。",
},
]}
/>

## 拡張された使用例 \{#extended-usage-example\}

```typescript showLineNumbers copy
const { getWorkflowState } = await run.stream({
  inputData: {
    value: '初期値',
  },
});

const result = await getWorkflowState();
```

## ストリームイベント \{#stream-events\}

ストリームはワークフローの実行中にさまざまなイベントタイプを送出します。各イベントには `type` フィールドと、関連データを含む `payload` が含まれます:

* **`start`**: ワークフローの実行が開始される
* **`step-start`**: ステップの実行が開始される
* **`tool-call`**: ツール呼び出しが開始される
* **`tool-call-streaming-start`**: ツール呼び出しのストリーミングが開始される
* **`tool-call-delta`**: ツール出力の増分更新
* **`step-result`**: ステップが結果とともに完了する
* **`step-finish`**: ステップの実行が終了する
* **`finish`**: ワークフローの実行が完了する

## 関連情報 \{#related\}

* [Workflows の概要](/docs/workflows/overview#testing-workflows-locally)
* [Workflow.createRunAsync()](../../../reference/workflows/workflow-methods/create-run)