---
title: "Mastra.getWorkflows() "
description: "Mastra の `Mastra.getWorkflows()` メソッドのドキュメント。設定済みのワークフローをすべて取得します。"
---

# Mastra.getWorkflows() \{#mastragetworkflows\}

`.getWorkflows()` メソッドは、Mastra インスタンスで構成されたすべてのワークフローを取得するために使用します。メソッドは省略可能なオプションオブジェクトを受け取ります。

## 使い方の例 \{#usage-example\}

```typescript copy
mastra.getWorkflows();
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "options",
type: "{ serialized?: boolean }",
description: "任意の設定オブジェクト。`serialized` が true の場合、完全なワークフローインスタンスではなく、name プロパティのみを持つ簡略化されたワークフローオブジェクトを返します。",
optional: true,
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "workflows",
type: "Record<string, Workflow>",
description: "設定済みのすべてのワークフローを格納したレコード。キーはワークフローID、値はワークフローのインスタンス（または serialized が true の場合は簡略化されたオブジェクト）。",
},
]}
/>

## 関連項目 \{#related\}

* [ワークフローの概要](/docs/workflows/overview)