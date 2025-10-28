---
title: "Workflow.createRunAsync() "
description: ワークフローで新しい実行インスタンスを作成する `Workflow.createRunAsync()` メソッドのドキュメントです。
---

# Workflow.createRunAsync() \{#workflowcreaterunasync\}

`.createRunAsync()` メソッドは、新しいワークフロー実行インスタンスを作成し、指定した入力データでワークフローを実行できるようにします。これは `Run` インスタンスを返す現行の API です。

:::note

メソッドを持つオブジェクトを返す旧式の `createRun()` メソッドについては、[Legacy Workflows](/docs/reference/legacyWorkflows/createRun) セクションを参照してください。

:::

## 使い方の例 \{#usage-example\}

```typescript copy
await workflow.createRunAsync();
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "runId",
type: "string",
description: "ワークフロー実行の任意のカスタム識別子",
isOptional: true,
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "run",
type: "Run",
description:
"ワークフローの実行に使用できる新しいワークフロー実行インスタンス",
},
]}
/>

## 拡張的な使用例 \{#extended-usage-example\}

```typescript showLineNumbers copy
const workflow = mastra.getWorkflow('workflow');

const run = await workflow.createRunAsync();

const result = await run.start({
  inputData: {
    value: 10,
  },
});
```

## 関連 \{#related\}

* [Run クラス](../run)
* [ワークフローの実行](/docs/examples/workflows/running-workflows)