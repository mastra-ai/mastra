---
title: "Workflow.sleepUntil() "
description: ワークフロー内の `Workflow.sleepUntil()` メソッドに関するドキュメント。指定した日時まで実行を一時停止します。
---

# Workflow.sleepUntil() \{#workflowsleepuntil\}

`.sleepUntil()` メソッドは、指定した日時まで処理を一時停止します。

## 使い方の例 \{#usage-example\}

```typescript copy
workflow.sleepUntil(new Date(Date.now() + 5000));
```

## パラメーター \{#parameters\}

<PropertiesTable
  content={[
{
name: "dateOrCallback",
type: "Date | ((params: ExecuteFunctionParams) => Promise<Date>)",
description: "Date オブジェクト、または Date を返すコールバック関数のいずれか。コールバックは実行時のコンテキストを受け取り、入力データに基づいて目標時刻を動的に算出できます。",
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
description: "メソッドチェーンのための Workflow インスタンス",
},
]}
/>

## 応用例 \{#extended-usage-example\}

```typescript showLineNumbers copy
workflow.sleepUntil(async ({ inputData }) => {
  return new Date(Date.now() + inputData.value);
});
```

## 関連項目 \{#related\}

* [Sleep とイベント](/docs/workflows/pausing-execution)