---
title: "Run.resume() "
description: ワークフローで使用する `Run.resume()` メソッドのドキュメント。停止中のワークフロー実行を新しいデータで再開します。
---

# Run.resume() \{#runresume\}

`.resume()` メソッドは、一時停止中のワークフロー実行を新しいデータで再開し、特定のステップからの実行を継続できるようにします。

## 使い方の例 \{#usage-example\}

```typescript showLineNumbers copy
const run = await workflow.createRunAsync();

const result = await run.start({ inputData: { value: '初期データ' } });

if (result.status === 'suspended') {
  const resumedResults = await run.resume({
    resumeData: { value: '再開データ' },
  });
}
```

## パラメーター \{#parameters\}

<PropertiesTable
  content={[
{
name: "resumeData",
type: "z.infer<TResumeSchema>",
description: "一時停止されたステップを再開するためのデータ。",
isOptional: true,
},
{
name: "step",
type: "Step<string, any, any, TResumeSchema, any, TEngineType> | [...Step<string, any, any, any, any, TEngineType>[], Step<string, any, any, TResumeSchema, any, TEngineType>] | string | string[]",
description: "実行を再開する開始ステップ。Step インスタンス、Step の配列、ステップ ID の文字列、またはステップ ID 文字列の配列を指定できます。",
isOptional: true,
},
{
name: "runtimeContext",
type: "RuntimeContext",
description: "再開時に使用するランタイムコンテキストデータ。",
isOptional: true,
},
{
name: "runCount",
type: "number",
description: "ネストされたワークフロー実行における任意の実行回数。",
isOptional: true,
},
{
name: "tracingContext",
type: "TracingContext",
isOptional: true,
description: "子スパンの作成やメタデータの追加に用いる AI トレーシングコンテキスト。Mastra のトレーシングシステム使用時に自動的に注入されます。",
properties: [
{
parameters: [{
name: "currentSpan",
type: "AISpan",
isOptional: true,
description: "子スパンの作成やメタデータの追加に用いる現在の AI スパン。実行中にカスタムの子スパンを作成したり、スパン属性を更新したりする際に使用します。"
}]
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
parameters: [{
name: "metadata",
type: "Record<string, any>",
isOptional: true,
description: "ルートトレーススパンに追加するメタデータ。ユーザー ID、セッション ID、フィーチャーフラグなどのカスタム属性の追加に役立ちます。"
}]
}
]
},
{
name: "outputOptions",
type: "OutputOptions",
isOptional: true,
description: "出力に関するオプション。",
properties: [
{
parameters: [{
name: "includeState",
type: "boolean",
isOptional: true,
description: "結果にワークフローの実行状態を含めるかどうか。"
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
name: "result",
type: "Promise<WorkflowResult<TState, TOutput, TSteps>>",
description: "ステップの出力とステータスを含むワークフロー実行結果に解決される Promise。",
},
{
name: "traceId",
type: "string",
isOptional: true,
description: "AI トレースが有効な場合、この実行に関連付けられるトレース ID。ログのひも付けや実行フローのデバッグに使用します。",
},
]}
/>

## 拡張された使用例 \{#extended-usage-example\}

```typescript showLineNumbers copy
if (result.status === 'suspended') {
  const resumedResults = await run.resume({
    step: result.suspended[0],
    resumeData: { value: 'データを再開' },
  });
}
```

> **注**: サスペンドされているステップが1つだけの場合は `step` パラメータを省略でき、ワークフローはそのステップを自動的に再開します。複数のステップがサスペンドされている場合は、再開するステップを明示的に指定する必要があります。

## 関連項目 \{#related\}

* [Workflows の概要](/docs/workflows/overview)
* [Run クラス](../run)
* [一時停止と再開](/docs/workflows/suspend-and-resume)
* [Human-in-the-loop の例](/docs/examples/workflows/human-in-the-loop)