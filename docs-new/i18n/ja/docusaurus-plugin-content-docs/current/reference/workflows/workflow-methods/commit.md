---
title: 'Workflow.commit() '
description: ワークフローで使用する `Workflow.commit()` メソッドのドキュメント。ワークフローを確定し、最終的な結果を返します。
---

# Workflow.commit() \{#workflowcommit\}

`.commit()` メソッドはワークフローを確定し、最終結果を返します。

## 使い方の例 \{#usage-example\}

```typescript copy
workflow.then(step1).commit();
```

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "workflow",
type: "Workflow",
description: "メソッドチェーン用のワークフローインスタンス",
},
]}
/>

## 関連項目 \{#related\}

* [制御フロー](/docs/workflows/control-flow)