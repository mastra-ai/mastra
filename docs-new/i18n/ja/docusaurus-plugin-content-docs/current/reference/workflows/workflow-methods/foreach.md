---
title: "Workflow.foreach()"
description: ワークフローの `Workflow.foreach()` メソッドに関するドキュメント。配列の各要素に対してステップを実行するループを作成します。
---

# Workflow.foreach() \{#workflowforeach\}

`.foreach()` メソッドは、配列内の各要素ごとにステップを実行するループを作成します。

## 使い方の例 \{#usage-example\}

```typescript copy
workflow.foreach(step1, { concurrency: 2 });
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "step",
type: "Step",
description:
"ループ内で実行する Step インスタンス。直前の Step は配列型を返す必要があります。",
isOptional: false,
},
{
name: "opts",
type: "object",
description:
"ループのオプション設定。concurrency オプションは並行実行できる反復回数を制御します（既定値: 1）",
isOptional: true,
properties: [
{
name: "concurrency",
type: "number",
description:
"同時に実行可能な反復回数（既定値: 1）",
isOptional: true,
},
],
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "workflow",
type: "Workflow",
description: "メソッドチェーン用のワークフロー インスタンス",
},
]}
/>

## 関連項目 \{#related\}

* [foreach を使った繰り返し](/docs/workflows/control-flow#repeating-with-foreach)