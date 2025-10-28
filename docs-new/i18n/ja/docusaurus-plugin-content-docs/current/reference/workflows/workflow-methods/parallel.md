---
title: "Workflow.parallel() "
description: ワークフローで複数のステップを同時に実行する `Workflow.parallel()` メソッドのドキュメントです。
---

# Workflow.parallel() \{#workflowparallel\}

`.parallel()` メソッドは、複数のステップを並列に実行します。

## 使い方の例 \{#usage-example\}

```typescript copy
workflow.parallel([step1, step2]);
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "steps",
type: "Step[]",
description: "並行実行するステップのインスタンス",
isOptional: false,
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "workflow",
type: "Workflow",
description: "メソッドチェーン用のワークフローインスタンス",
},
]}
/>

## 関連項目 \{#related\}

* [並列ワークフローの例](/docs/examples/workflows/parallel-steps)