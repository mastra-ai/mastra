---
title: "Workflow.then()"
description: ワークフローの`.then()`メソッドに関するドキュメント。ステップ間に順次の依存関係を作成します。
---

# Workflow.then() \{#workflowthen\}

`.then()` メソッドは、ワークフローのステップ間に順次的な依存関係を作り、ステップが所定の順序で実行されることを保証します。

## 使い方 \{#usage\}

```typescript
workflow.step(stepOne).then(stepTwo).then(stepThree);
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "step",
type: "Step | string",
description:
"前のステップが完了した後に実行されるべきステップのインスタンスまたはステップID",
isOptional: false,
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "workflow",
type: "LegacyWorkflow",
description: "メソッドチェーンに使用する workflow インスタンス",
},
]}
/>

## 検証 \{#validation\}

`then` を使用する場合:

* 前のステップがワークフロー内に存在している必要がある
* ステップは循環依存関係を形成してはならない
* 各ステップは直列のチェーン内で一度しか出現できない

## エラーハンドリング \{#error-handling\}

```typescript
try {
  workflow
    .step(stepA)
    .then(stepB)
    .then(stepA) // エラーをスローします - 循環依存
    .commit();
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(error.type); // 'circular_dependency'
    console.log(error.details);
  }
}
```

## 関連 \{#related\}

* [step リファレンス](./step-class)
* [after リファレンス](./after)
* [逐次ステップの例](/docs/examples/workflows_legacy/sequential-steps)
* [制御フローのガイド](/docs/examples/workflows_legacy/conditional-branching)