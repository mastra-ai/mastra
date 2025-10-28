---
title: "Run.start()"
description: ワークフローで `Run.start()` メソッドを使い、入力データでワークフロー実行を開始する方法のドキュメントです。
---

# Run.start() \{#runstart\}

`.start()` メソッドは、入力データを指定してワークフローの実行を開始し、ワークフローを最初から実行できます。

## 使い方の例 \{#usage-example\}

```typescript showLineNumbers copy
const run = await workflow.createRunAsync();

const result = await run.start({
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
name: "writableStream",
type: "WritableStream<ChunkType>",
description: "ワークフローの出力をストリーミングするための任意指定の書き込み可能ストリーム",
isOptional: true,
},
{
name: "tracingContext",
type: "TracingContext",
isOptional: true,
description: "子スパンの作成やメタデータの追加に用いる AI トレーシング用コンテキスト。Mastra のトレーシングシステムを利用する場合は自動的に挿入されます。",
properties: [
{
parameters: [{
name: "currentSpan",
type: "AISpan",
isOptional: true,
description: "子スパンの作成やメタデータの追加に用いる現在の AI スパン。これを使って、実行中にカスタムの子スパンを作成したり、スパン属性を更新できます。"
}]
}
]
},
{
name: "tracingOptions",
type: "TracingOptions",
isOptional: true,
description: "AI トレーシング構成のオプション。",
properties: [
{
parameters: [{
name: "metadata",
type: "Record<string, any>",
isOptional: true,
description: "ルートトレーススパンに追加するメタデータ。ユーザー ID、セッション ID、フラグなどのカスタム属性を付与するのに便利です。"
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
description: "ステップの出力とステータスを含むワークフロー実行結果で解決される Promise。",
},
{
name: "traceId",
type: "string",
isOptional: true,
description: "AI トレーシングが有効な場合、この実行に関連付けられるトレース ID。ログの突き合わせや実行フローのデバッグに使用します。",
},
]}
/>

## 応用的な使用例 \{#extended-usage-example\}

```typescript showLineNumbers copy
import { RuntimeContext } from '@mastra/core/runtime-context';

const run = await workflow.createRunAsync();

const runtimeContext = new RuntimeContext();
runtimeContext.set('variable', false);

const result = await run.start({
  inputData: {
    value: '初期データ',
  },
  runtimeContext,
});
```

## 関連事項 \{#related\}

* [ワークフローの概要](/docs/workflows/overview)
* [Run クラス](../run)