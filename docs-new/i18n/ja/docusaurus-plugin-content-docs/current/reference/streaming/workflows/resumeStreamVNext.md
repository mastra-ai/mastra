---
title: "Run.resumeStreamVNext() "
description: ワークフローで使用する `Run.resumeStreamVNext()` メソッドのドキュメント。中断中のワークフロー実行をリアルタイムに再開し、ストリーミングを有効にします。
---

# Run.resumeStreamVNext()（実験的） \{#runresumestreamvnext-experimental\}

:::caution 実験的

この機能は実験的であり、API は今後のリリースで変更される可能性があります。

:::

`.resumeStreamVNext()` メソッドは、新しいデータを用いて一時停止中のワークフロー実行を再開し、特定のステップから処理を続行しつつ、イベントのストリームを観察できます。

## 使い方の例 \{#usage-example\}

```typescript showLineNumbers copy
const run = await workflow.createRunAsync();

const stream = run.streamVNext({
  inputData: {
    value: '初期データ',
  },
});

const result = await stream.result;

if (result!.status === 'suspended') {
  const resumedStream = await run.resumeStreamVNext({
    resumeData: {
      value: '再開データ',
    },
  });
}
```

## パラメーター \{#parameters\}

<PropertiesTable
  content={[
{
name: "resumeData",
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
name: "step",
type: "Step<string, any, any, any, any, TEngineType>",
description: "実行を再開する起点となるステップ",
isOptional: true,
},
{
name: "tracingOptions",
type: "TracingOptions",
isOptional: true,
description: "AI トレーシング設定のオプション。",
properties: [
{
parameters: [{
name: "metadata",
type: "Record<string, any>",
isOptional: true,
description: "ルートのトレーススパンに追加するメタデータ。ユーザー ID、セッション ID、フィーチャーフラグなどのカスタム属性を追加する際に便利です。"
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
type: "MastraWorkflowStream<ChunkType>",
description: "追加のワークフロー固有プロパティを持つ ReadableStream<ChunkType> を拡張したカスタムストリーム",
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
]}
/>

## ストリームイベント \{#stream-events\}

ストリームはワークフローの実行中にさまざまな種類のイベントを発生させます。各イベントには `type` フィールドと、関連データを含む `payload` が含まれます:

* **`workflow-start`**: ワークフローの実行が開始される
* **`workflow-step-start`**: ステップの実行が開始される
* **`workflow-step-output`**: ステップからのカスタム出力
* **`workflow-step-result`**: ステップが結果とともに完了する
* **`workflow-finish`**: 使用状況統計とともにワークフローの実行が完了する

## 関連項目 \{#related\}

* [Workflows の概要](/docs/workflows/overview#testing-workflows-locally)
* [Workflow.createRunAsync()](../../../reference/workflows/workflow-methods/create-run)
* [Run.streamVNext()](./streamVNext)