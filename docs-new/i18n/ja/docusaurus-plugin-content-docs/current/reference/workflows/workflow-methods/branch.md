---
title: "リファレンス: Workflow.branch()"
description: ワークフローの `Workflow.branch()` メソッドに関するドキュメント。ステップ間に条件分岐を作成します。
---

# Workflow.branch() \{#workflowbranch\}

`.branch()` メソッドは、ワークフロー内のステップ間に条件分岐を作成し、前のステップの結果に応じて異なる処理経路を選択できるようにします。

## 使い方の例 \{#usage-example\}

```typescript copy
workflow.branch([
  [async ({ context }) => true, step1],
  [async ({ context }) => false, step2],
]);
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "steps",
type: "[() => boolean, Step]",
description:
"各要素が、条件関数とその条件が真の場合に実行するステップからなるタプルの配列",
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
description: "メソッドチェーンのためのワークフローインスタンス",
},
]}
/>

## 関連項目 \{#related\}

* [条件分岐ロジック](/docs/workflows/control-flow#conditional-logic-with-branch)
* [条件分岐の例](/docs/examples/workflows/conditional-branching)