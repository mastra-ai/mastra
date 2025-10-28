---
title: "Workflow.sleep() "
description: ワークフローで使用する `Workflow.sleep()` メソッドのドキュメント。実行を指定したミリ秒間一時停止します。
---

# Workflow.sleep() \{#workflowsleep\}

`.sleep()` メソッドは、指定したミリ秒間、実行を一時停止します。

## 使い方の例 \{#usage-example\}

```typescript copy
workflow.sleep(5000);
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "milliseconds",
type: "number",
description: "実行を一時停止する時間（ミリ秒）",
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

* [Sleep とイベント](/docs/workflows/pausing-execution)