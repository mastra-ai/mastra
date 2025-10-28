---
title: "Workflow.until()"
description: "Mastra のワークフローにおける `.until()` メソッドのドキュメント。指定した条件が真になるまでステップを繰り返します。"
---

# Workflow.until() \{#workflowuntil\}

`.until()` メソッドは、指定した条件が真になるまでステップを繰り返します。これにより、条件が満たされるまで指定のステップを実行し続けるループが作成されます。

## 使い方 \{#usage\}

```typescript
workflow.step(incrementStep).until(condition, incrementStep).then(finalStep);
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "condition",
type: "Function | ReferenceCondition",
description:
"ループの停止タイミングを判定する関数または参照条件",
isOptional: false,
},
{
name: "step",
type: "Step",
description: "条件が満たされるまで繰り返すステップ",
isOptional: false,
},
]}
/>

## 条件タイプ \{#condition-types\}

### 関数の条件 \{#function-condition\}

真偽値を返す関数を使用できます：

```typescript
workflow
  .step(incrementStep)
  .until(async ({ context }) => {
    const result = context.getStepResult<{ value: number }>('increment');
    return (result?.value ?? 0) >= 10; // 値が10以上になったら停止
  }, incrementStep)
  .then(finalStep);
```

### 参照条件 \{#reference-condition\}

比較演算子を使った参照ベースの条件を利用できます。

```typescript
workflow
  .step(incrementStep)
  .until(
    {
      ref: { step: incrementStep, path: 'value' },
      query: { $gte: 10 }, // 値が10以上になったら停止
    },
    incrementStep,
  )
  .then(finalStep);
```

## 比較演算子 \{#comparison-operators\}

参照に基づく条件を使用する場合、次の比較演算子を使用できます：

| Operator | 説明                     | 例             |
| -------- | ------------------------ | -------------- |
| `$eq`    | 等しい                   | `{ $eq: 10 }`  |
| `$ne`    | 等しくない               | `{ $ne: 0 }`   |
| `$gt`    | より大きい               | `{ $gt: 5 }`   |
| `$gte`   | 以上                     | `{ $gte: 10 }` |
| `$lt`    | より小さい               | `{ $lt: 20 }`  |
| `$lte`   | 以下                     | `{ $lte: 15 }` |

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "workflow",
type: "Workflow",
description: "チェーン用のワークフローインスタンス。",
},
]}
/>

## 例 \{#example\}

```typescript
import { LegacyWorkflow, LegacyStep } from '@mastra/core/workflows/legacy';
import { z } from 'zod';

// カウンターを1増やすステップを作成
const incrementStep = new LegacyStep({
  id: 'increment',
  description: 'カウンターを1増やす',
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async ({ context }) => {
    // 前回実行の結果から現在値を取得するか、なければ0から開始
    const currentValue =
      context.getStepResult<{ value: number }>('increment')?.value ||
      context.getStepResult<{ startValue: number }>('trigger')?.startValue ||
      0;

    // 値を1増やす
    const value = currentValue + 1;
    console.log(`値を${value}に増やします`);

    return { value };
  },
});

// 最終ステップを作成
const finalStep = new LegacyStep({
  id: 'final',
  description: 'ループ完了後の最終ステップ',
  execute: async ({ context }) => {
    const finalValue = context.getStepResult<{ value: number }>('increment')?.value;
    console.log(`ループは最終値 ${finalValue} で完了しました`);
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

// until ループでワークフローを設定
counterWorkflow
  .step(incrementStep)
  .until(async ({ context }) => {
    const targetValue = context.triggerData.targetValue;
    const currentValue = context.getStepResult<{ value: number }>('increment')?.value ?? 0;
    return currentValue >= targetValue;
  }, incrementStep)
  .then(finalStep)
  .commit();

// ワークフローを実行
const run = counterWorkflow.createRun();
const result = await run.start({
  triggerData: { startValue: 0, targetValue: 5 },
});
// 0から5までインクリメントし、停止して finalStep を実行
```

## 関連項目 \{#related\}

* [.while()](./while) - 条件が真の間、ループを実行
* [制御フローガイド](/docs/examples/workflows_legacy/conditional-branching)
* [Workflow クラス リファレンス](./workflow)