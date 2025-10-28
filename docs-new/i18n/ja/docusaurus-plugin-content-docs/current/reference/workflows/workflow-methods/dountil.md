---
title: "Workflow.dountil() "
description: ワークフローで使用する `Workflow.dountil()` メソッドのドキュメント。条件が満たされるまでステップを実行するループを作成します。
---

# Workflow.dountil() \{#workflowdountil\}

`.dountil()` メソッドは、条件が満たされるまでステップを実行します。条件を評価する前に、必ずステップを少なくとも一度は実行します。条件が初めて評価されるとき、`iterationCount` は `1` です。

## 使い方の例 \{#usage-example\}

```typescript copy
workflow.dountil(step1, async ({ inputData }) => true);
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "step",
type: "Step",
description: "ループ内で実行する Step インスタンス",
isOptional: false,
},
{
name: "condition",
type: "(params : ExecuteParams & { iterationCount: number }) => Promise<boolean>",
description:
"ループを継続するかどうかを示す真偽値を返す関数。実行パラメータと反復回数を受け取ります。",
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
description: "メソッドチェーン用の Workflow インスタンス",
},
]}
/>

## 関連項目 \{#related\}

* [Control Flow](/docs/workflows/control-flow)

* [ExecuteParams](../step#executeparams)