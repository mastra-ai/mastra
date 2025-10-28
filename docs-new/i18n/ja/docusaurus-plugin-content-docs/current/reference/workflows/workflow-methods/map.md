---
title: "Workflow.map()"
description: ワークフローにおける `Workflow.map()` メソッドのドキュメント。前のステップの出力データを後続ステップの入力へマップします。
---

# Workflow.map() \{#workflowmap\}

`.map()` メソッドは、前のステップの出力データを後続ステップの入力に対応付け、ステップ間でデータを変換できるようにします。

## 使い方の例 \{#usage-example\}

```typescript copy
workflow.map(async ({ inputData }) => `${inputData.value} - map`
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "mappingFunction",
type: "(params: { inputData: any }) => any",
description: "入力データを変換し、マップされた結果を返す関数",
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
description: "メソッドチェーンに用いる Workflow インスタンス",
},
]}
/>

## 関連情報 \{#related\}

* [入力データのマッピング](/docs/workflows/input-data-mapping)