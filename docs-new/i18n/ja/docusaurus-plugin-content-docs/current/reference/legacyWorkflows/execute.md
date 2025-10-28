---
title: "Workflow.execute()"
description: "Mastra のワークフローにおける `.execute()` メソッドのドキュメント。ワークフローの各ステップを実行し、結果を返します。"
---

# Workflow.execute() \{#workflowexecute\}

指定されたトリガーデータを使用してワークフローを実行し、結果を返します。実行前にワークフローをコミットしておく必要があります。

## 使い方の例 \{#usage-example\}

```typescript
const workflow = new LegacyWorkflow({
  name: 'my-workflow',
  triggerSchema: z.object({
    inputValue: z.number(),
  }),
});

workflow.step(stepOne).then(stepTwo).commit();

const result = await workflow.execute({
  triggerData: { inputValue: 42 },
});
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "options",
type: "ExecuteOptions",
description: "ワークフロー実行のオプション",
isOptional: true,
properties: [
{
name: "triggerData",
type: "TriggerSchema",
description: "ワークフローのトリガースキーマに適合する入力データ",
isOptional: false,
},
{
name: "runId",
type: "string",
description: "この実行を追跡するための任意のID",
isOptional: true,
},
],
},
]}
/>

## 返り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "WorkflowResult",
type: "object",
description: "ワークフロー実行の結果",
properties: [
{
name: "runId",
type: "string",
description: "この実行の一意の識別子",
},
{
name: "results",
type: "Record<string, StepResult>",
description: "完了した各ステップの結果",
},
{
name: "status",
type: "WorkflowStatus",
description: "この実行の最終ステータス",
},
],
},
]}
/>

## 追加の例 \{#additional-examples\}

実行 ID を指定して実行：

```typescript
const result = await workflow.execute({
  runId: 'custom-run-id',
  triggerData: { inputValue: 42 },
});
```

実行結果の扱い：

```typescript
const { runId, results, status } = await workflow.execute({
  triggerData: { inputValue: 42 },
});

if (status === 'COMPLETED') {
  console.log('ステップ結果:', results);
}
```

### 関連項目 \{#related\}

* [Workflow.createRun()](./createRun)
* [Workflow.commit()](./commit)
* [Workflow.start()](./start)