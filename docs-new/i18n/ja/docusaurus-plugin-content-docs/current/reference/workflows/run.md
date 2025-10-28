---
title: "Run クラス"
description: Mastra の Run クラスに関するドキュメント。ワークフローの実行インスタンスを表します。
---

# Run クラス \{#run-class\}

`Run` クラスはワークフローの実行インスタンスを表し、実行の開始、再開、ストリーミング、監視を行うためのメソッドを提供します。

## 使い方の例 \{#usage-example\}

```typescript showLineNumbers copy
const run = await workflow.createRunAsync();

const result = await run.start({
  inputData: { value: '初期データ' },
});

if (result.status === 'suspended') {
  const resumedResult = await run.resume({
    resumeData: { value: '再開データ' },
  });
}
```

## 実行メソッド \{#run-methods\}

<PropertiesTable
  content={[
{
name: "start",
type: "(options?: StartOptions) => Promise<WorkflowResult>",
description: "入力データを用いてワークフローの実行を開始します",
required: true,
},
{
name: "resume",
type: "(options?: ResumeOptions) => Promise<WorkflowResult>",
description: "一時停止中のワークフローを特定のステップから再開します",
required: true,
},
{
name: "stream",
type: "(options?: StreamOptions) => Promise<StreamResult>",
description: "ワークフローの実行をイベントストリームとして監視します",
required: true,
},
{
name: "streamVNext",
type: "(options?: StreamOptions) => MastraWorkflowStream",
description: "拡張機能によるリアルタイムストリーミングを有効にします",
required: true,
},
{
name: "watch",
type: "(callback: WatchCallback, type?: WatchType) => UnwatchFunction",
description: "コールバックベースのイベントでワークフローの実行を監視します",
required: true,
},
{
name: "cancel",
type: "() => Promise<void>",
description: "ワークフローの実行をキャンセルします",
required: true,
}
]}
/>

## 実行ステータス \{#run-status\}

ワークフロー実行の `status` は、現在の実行状態を示します。取り得る値は次のとおりです。

<PropertiesTable
  content={[
{
name: "success",
type: "string",
description:
"すべてのステップが正常に完了し、有効な結果が出力された状態",
},
{
name: "failed",
type: "string",
description:
"実行中にエラーが発生し、エラーの詳細が参照可能な状態",
},
{
name: "suspended",
type: "string",
description:
"再開待ちで実行が一時停止されており、一時停止中のステップ情報が含まれる状態",
},
]}
/>

## 関連項目 \{#related\}

* [ワークフローの実行](/docs/examples/workflows/running-workflows)
* [Run.start()](./run-methods/start)
* [Run.resume()](./run-methods/resume)
* [Run.stream()](/docs/reference/streaming/workflows/stream)
* [Run.streamVNext()](/docs/reference/streaming/workflows/streamVNext)
* [Run.watch()](./run-methods/watch)
* [Run.cancel()](./run-methods/cancel)