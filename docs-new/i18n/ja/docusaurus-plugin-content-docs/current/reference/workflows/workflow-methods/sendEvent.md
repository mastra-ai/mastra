---
title: "Workflow.sendEvent() "
description: ワークフローでの `Workflow.sendEvent()` メソッドのドキュメント。イベントの送信時に実行が再開されます。
---

# Workflow.sendEvent() \{#workflowsendevent\}

`.sendEvent()` は、イベントが送信されると実行を再開します。

## 使い方の例 \{#usage-example\}

```typescript copy
workflow.sendEvent('event-name', step1);
```

## パラメーター \{#parameters\}

<PropertiesTable
  content={[
{
name: "eventName",
type: "string",
description: "送信するイベントの名前",
isOptional: false,
},
{
name: "step",
type: "Step",
description: "イベント送信後に再開するステップ",
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

## 関連情報 \{#related\}

* [Sleep とイベント](/docs/workflows/pausing-execution)