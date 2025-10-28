---
title: "Workflow.while() "
description: "Mastra ワークフローの `.while()` メソッドに関するドキュメント。指定した条件が真である間、ステップを繰り返します。"
---

# Workflow.while() \{#workflowwhile\}

`.while()` メソッドは、指定した条件が真である限り、ステップを繰り返します。これにより、条件が偽になるまで指定のステップを実行し続けるループが作成されます。

## 使い方 \{#usage\}

```typescript
workflow.step(incrementStep).while(condition, incrementStep).then(finalStep);
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "condition",
type: "Function | ReferenceCondition",
description:
"ループを継続する条件を判定する関数または参照条件",
isOptional: false,
},
{
name: "step",
type: "Step",
description: "条件が真のあいだ繰り返すステップ",
isOptional: false,
},
]}
/>

## 条件の種類 \{#condition-types\}

### 関数条件 \{#function-condition\}

真偽値を返す関数を使用できます：

```typescript
workflow
  .step(incrementStep)
  .while(async ({ context }) => {
    const result = context.getStepResult<{ value: number }>('increment');
    return (result?.value ?? 0) < 10; // 値が10未満の間は処理を続行
  }, incrementStep)
  .then(finalStep);
```

### 参照条件 \{#reference-condition\}

比較演算子を使って、参照に基づく条件を利用できます。

```typescript
workflow
  .step(incrementStep)
  .while(
    {
      ref: { step: incrementStep, path: 'value' },
      query: { $lt: 10 }, // 値が10未満の間は継続
    },
    incrementStep,
  )
  .then(finalStep);
```

## 比較演算子 \{#comparison-operators\}

参照に基づく条件を使用する場合、次の比較演算子を使用できます。

| 演算子 | 説明                     | 例              |
| ------ | ------------------------ | --------------- |
| `$eq`  | 等しい                   | `{ $eq: 10 }`   |
| `$ne`  | 等しくない               | `{ $ne: 0 }`    |
| `$gt`  | より大きい               | `{ $gt: 5 }`    |
| `$gte` | 以上                     | `{ $gte: 10 }`  |
| `$lt`  | より小さい               | `{ $lt: 20 }`   |
| `$lte` | 以下                     | `{ $lte: 15 }`  |

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "workflow",
type: "LegacyWorkflow",
description: "連結に使用するワークフローインスタンス",
},
]}
/>

## 例 \{#example\}

```typescript
import { LegacyWorkflow, LegacyStep } from '@mastra/core/workflows/legacy';
import { z } from 'zod';

// カウンターを1ずつ増やすステップを作成
const incrementStep = new LegacyStep({
  id: 'increment',
  description: 'カウンターを1増やす',
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async ({ context }) => {
    // 前回の実行結果から現在値を取得し、なければ0から開始
    const currentValue =
      context.getStepResult<{ value: number }>('increment')?.value ||
      context.getStepResult<{ startValue: number }>('trigger')?.startValue ||
      0;

    // 値を1増やす
    const value = currentValue + 1;
    console.log(`${value} に増加中`);

    return { value };
  },
});

// 最終ステップを作成
const finalStep = new LegacyStep({
  id: 'final',
  description: 'ループ完了後の最終ステップ',
  execute: async ({ context }) => {
    const finalValue = context.getStepResult<{ value: number }>('increment')?.value;
    console.log(`最終値 ${finalValue} でループが完了しました`);
    return { finalValue };
  },
});

// ワークフローを作成
const counterWorkflow = new LegacyWorkflow({
  name: 'counter-workflow',
  triggerSchema: z.object({
    startValue: z.number(),
    targetValue: z.number(),
  }),
});

// whileループでワークフローを構成
counterWorkflow
  .step(incrementStep)
  .while(async ({ context }) => {
    const targetValue = context.triggerData.targetValue;
    const currentValue = context.getStepResult<{ value: number }>('increment')?.value ?? 0;
    return currentValue < targetValue;
  }, incrementStep)
  .then(finalStep)
  .commit();

// ワークフローを実行
const run = counterWorkflow.createRun();
const result = await run.start({
  triggerData: { startValue: 0, targetValue: 5 },
});
// 0から4までインクリメントし、その後停止してfinalStepを実行
```

## 関連項目 \{#related\}

* [.until()](./until) - 条件が満たされるまでループする
* [制御フローガイド](/docs/examples/workflows_legacy/conditional-branching)
* [Workflow クラスリファレンス](./workflow)