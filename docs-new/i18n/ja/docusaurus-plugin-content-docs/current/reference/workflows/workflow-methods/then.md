---
title: "Workflow.then() "
description: ワークフローの `Workflow.then()` メソッドに関するドキュメント。ステップ間に順序的な依存関係を作成します。
---

# Workflow.then() \{#workflowthen\}

`.then()` メソッドは、ワークフローのステップ間に逐次的な依存関係を作成し、ステップが所定の順序で実行されるようにします。

## 使い方の例 \{#usage-example\}

```typescript copy
workflow.then(step1).then(step2);
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "step",
type: "Step",
description:
"前のステップの完了後に実行されるステップのインスタンス",
isOptional: false,
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "workflow",
type: "NewWorkflow",
description: "メソッドチェーンに使用する workflow インスタンス",
},
]}
/>

## 関連項目 \{#related\}

* [制御フロー](/docs/workflows/control-flow)