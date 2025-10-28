---
title: "Workflow.commit() "
description: ワークフローの`.commit()`メソッドに関するドキュメント。現在のステップ構成でワークフロー・マシンを再初期化します。
---

# Workflow.commit() \{#workflowcommit\}

`.commit()` メソッドは、現在のステップ構成を用いてワークフローのステートマシンを再初期化します。

## 使い方 \{#usage\}

```typescript
workflow.step(stepA).then(stepB).commit();
```

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "workflow",
type: "LegacyWorkflow",
description: "ワークフローのインスタンス",
},
]}
/>

## 関連 \{#related\}

* [分岐パスの例](/docs/examples/workflows_legacy/branching-paths)
* [Workflow クラス リファレンス](./workflow)
* [Step リファレンス](./step-class)
* [制御フロー ガイド](/docs/examples/workflows_legacy/conditional-branching)