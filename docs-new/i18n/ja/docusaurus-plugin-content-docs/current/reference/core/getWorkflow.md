---
title: "Mastra.getWorkflow()"
description: "Mastra の `Mastra.getWorkflow()` メソッドに関するドキュメント。ID によってワークフローを取得します。"
---

# Mastra.getWorkflow() \{#mastragetworkflow\}

`.getWorkflow()` メソッドは、ID を指定してワークフローを取得します。ワークフロー ID と、任意の options オブジェクトを受け取ります。

## 使い方の例 \{#usage-example\}

```typescript copy
mastra.getWorkflow('testWorkflow');
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "id",
type: "TWorkflowId extends keyof TWorkflows",
description: "取得するワークフローのID。Mastra の設定に存在する有効なワークフロー ID である必要があります。",
},
{
name: "options",
type: "{ serialized?: boolean }",
description: "任意の設定オブジェクト。`serialized` が true の場合、完全なワークフローインスタンスではなく、ワークフロー名のみを返します。",
optional: true,
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "workflow",
type: "TWorkflows[TWorkflowId]",
description: "指定したIDのワークフローインスタンス。見つからない場合はエラーをスローします。",
},
]}
/>

## 関連項目 \{#related\}

* [ワークフローの概要](/docs/workflows/overview)