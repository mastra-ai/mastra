---
title: "Workflow.else() "
description: "Mastra のワークフローにおける `.else()` メソッドのドキュメント。if 条件が false の場合に代替の分岐を作成します。"
---

# Workflow.else() \{#workflowelse\}

> 実験的

`.else()` メソッドは、直前の `if` 条件が false と評価された場合に実行される代替の分岐をワークフロー内に作成します。これにより、条件に応じてワークフローが異なる経路をたどれるようになります。

## 使い方 \{#usage\}

```typescript copy showLineNumbers
workflow
  .step(startStep)
  .if(async ({ context }) => {
    const value = context.getStepResult<{ value: number }>('start')?.value;
    return value < 10;
  })
  .then(ifBranchStep)
  .else() // 条件が false の場合の代替ブランチ
  .then(elseBranchStep)
  .commit();
```

## パラメータ \{#parameters\}

`else()` メソッドには引数はありません。

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "workflow",
type: "LegacyWorkflow",
description: "メソッドチェーンに使用するワークフローインスタンス",
},
]}
/>

## 挙動 \{#behavior\}

* ワークフロー定義では、`else()` メソッドは `if()` ブランチの直後に置く必要があります
* 直前の `if` 条件が false と評価された場合にのみ実行されるブランチを作成します
* `.then()` を使って、`else()` の後に複数のステップをチェーンできます
* `else` ブランチ内に追加の `if`/`else` 条件をネストできます

## エラー処理 \{#error-handling\}

`else()` メソッドを使うには、直前に `if()` 文が必要です。先行する `if` なしで使おうとするとエラーになります。

```typescript
try {
  // これはエラーをスローします
  workflow.step(someStep).else().then(anotherStep).commit();
} catch (error) {
  console.error(error); // "アクティブな条件が見つかりません"
}
```

## 関連情報 \{#related\}

* [if リファレンス](./if)
* [then リファレンス](./then)
* [制御フロー ガイド](/docs/examples/workflows_legacy/conditional-branching)
* [ステップ条件 リファレンス](./step-condition)