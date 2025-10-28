---
title: "start() "
description: "ワークフローで `start()` メソッドのドキュメント。ワークフロー実行を開始します。"
---

# start() \{#start\}

start 関数はワークフローの実行を開始します。定義されたワークフローの順序に従ってすべてのステップを処理し、並列実行、分岐ロジック、ステップの依存関係を扱います。

## 使い方 \{#usage\}

```typescript copy showLineNumbers
const { runId, start } = workflow.createRun();
const result = await start({
  triggerData: { inputValue: 42 },
});
```

## パラメーター \{#parameters\}

<PropertiesTable
  content={[
{
name: "config",
type: "object",
description: "ワークフロー実行を開始するための構成",
isOptional: true,
},
]}
/>

### config \{#config\}

<PropertiesTable
  content={[
{
name: "triggerData",
type: "Record<string, any>",
description: "ワークフローの triggerSchema に適合する初期データ",
isOptional: false,
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "results",
type: "Record<string, any>",
description: "完了したすべてのワークフローステップの出力をまとめたもの",
},
{
name: "status",
type: "'completed' | 'error' | 'suspended'",
description: "ワークフロー実行の最終的なステータス",
},
]}
/>

## エラー処理 \{#error-handling\}

start 関数は、いくつかの種類の検証エラーをスローすることがあります。

```typescript copy showLineNumbers
try {
  const result = await start({ triggerData: data });
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(error.type); // 'circular_dependency' | 'no_terminal_path' | 'unreachable_step'
    console.log(error.details);
  }
}
```

## 関連項目 \{#related\}

* [例: ワークフローの作成](/docs/examples/workflows_legacy/creating-a-workflow)
* [例: 一時停止と再開](/docs/examples/workflows_legacy/suspend-and-resume)
* [createRun リファレンス](./createRun)
* [Workflow クラスリファレンス](./workflow)
* [Step クラスリファレンス](./step-class)

```
```
