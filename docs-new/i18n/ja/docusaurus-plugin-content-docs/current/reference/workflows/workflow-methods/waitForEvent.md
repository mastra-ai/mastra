---
title: "Workflow.waitForEvent() "
description: ワークフローで使用する `Workflow.waitForEvent()` メソッドのドキュメント。イベントを受信するまで実行を一時停止します。
---

# Workflow.waitForEvent() \{#workflowwaitforevent\}

`.waitForEvent()` メソッドは、イベントを受信するまで実行を一時停止します。

## 使い方の例 \{#usage-example\}

```typescript copy
workflow.waitForEvent('event-name', step1);
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "eventName",
type: "string",
description: "待機するイベント名",
isOptional: false,
},
{
name: "step",
type: "Step",
description: "イベント受信後に再開するステップ",
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

## 関連 \{#related\}

* [Sleep とイベント](/docs/workflows/pausing-execution)