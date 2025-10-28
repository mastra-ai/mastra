---
title: "Workflow.dowhile() "
description: ワークフローで使用する `Workflow.dowhile()` メソッドのドキュメント。条件が満たされているあいだ、ステップを実行し続けるループを作成します。
---

# Workflow.dowhile() \{#workflowdowhile\}

`.dowhile()` メソッドは、条件が満たされているあいだステップを実行します。条件を評価する前に、必ず少なくとも一度はステップを実行します。条件が最初に評価されるとき、`iterationCount` は `1` です。

## 使い方の例 \{#usage-example\}

```typescript copy
workflow.dowhile(step1, async ({ inputData }) => true);
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
"ループを継続すべきかを示す真偽値を返す関数。実行パラメータと反復回数を引数として受け取ります。",
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
description: "メソッドチェーンに使用する Workflow インスタンス",
},
]}
/>

## 関連項目 \{#related\}

* [Control Flow](/docs/workflows/control-flow)

* [ExecuteParams](../step#executeparams)