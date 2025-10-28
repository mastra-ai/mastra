---
title: "Workflow.if() "
description: "Mastra のワークフローにおける `.if()` メソッドのドキュメント。指定した条件に応じて条件分岐を作成します。"
---

# Workflow.if() \{#workflowif\}

> 実験的

`.if()` メソッドはワークフロー内に条件分岐を作成し、指定した条件が真の場合にのみステップを実行できるようにします。これにより、前のステップの結果に基づいて動的なワークフローの分岐を実現できます。

## 使い方 \{#usage\}

```typescript copy showLineNumbers
workflow
  .step(startStep)
  .if(async ({ context }) => {
    const value = context.getStepResult<{ value: number }>('start')?.value;
    return value < 10; // trueの場合、"if"分岐を実行
  })
  .then(ifBranchStep)
  .else()
  .then(elseBranchStep)
  .commit();
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "condition",
type: "Function | ReferenceCondition",
description:
"'if' 分岐を実行するかどうかを判定する関数または参照条件",
isOptional: false,
},
]}
/>

## 条件タイプ \{#condition-types\}

### 関数による条件 \{#function-condition\}

真偽値を返す関数を使用できます:

```typescript
workflow
  .step(startStep)
  .if(async ({ context }) => {
    const result = context.getStepResult<{ status: string }>('start');
    return result?.status === 'success'; // ステータスが "success" の場合に "if" 分岐を実行
  })
  .then(successStep)
  .else()
  .then(failureStep);
```

### 参照条件 \{#reference-condition\}

比較演算子を使って、参照に基づく条件を指定できます。

```typescript
workflow
  .step(startStep)
  .if({
    ref: { step: startStep, path: 'value' },
    query: { $lt: 10 }, // 値が10未満の場合に"if"分岐を実行
  })
  .then(ifBranchStep)
  .else()
  .then(elseBranchStep);
```

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "workflow",
type: "LegacyWorkflow",
description: "メソッドチェーン用のワークフローインスタンス",
},
]}
/>

## エラーハンドリング \{#error-handling\}

`if` メソッドを使うには、直前のステップが定義されている必要があります。前のステップなしで使用しようとすると、エラーが発生します。

```typescript
try {
  // これはエラーをスローします
  workflow
    .if(async ({ context }) => true)
    .then(someStep)
    .commit();
} catch (error) {
  console.error(error); // "条件の後に実行されるステップが必要です"
}
```

## 関連情報 \{#related\}

* [else リファレンス](./else)
* [then リファレンス](./then)
* [制御フロー ガイド](/docs/examples/workflows_legacy/conditional-branching)
* [ステップ条件 リファレンス](./step-condition)