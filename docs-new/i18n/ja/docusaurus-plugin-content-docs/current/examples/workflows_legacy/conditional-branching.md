---
title: "条件分岐（試験的）"
description: if/else 文を用いてレガシーなワークフローに条件分岐を作成するために Mastra を使用する例。
---

# ワークフロー（レガシー）の条件分岐（実験的） \{#workflow-legacy-with-conditional-branching-experimental\}

ワークフローは条件に応じて処理経路が分かれることがよくあります。この例では、レガシーのワークフローで条件分岐を作成するために `if` と `else` を使う方法を示します。

## 基本的な if/else の例 \{#basic-ifelse-example\}

この例では、数値に応じて分岐するシンプルなレガシーワークフローを示します。

```ts showLineNumbers copy
import { Mastra } from '@mastra/core';
import { LegacyStep, LegacyWorkflow } from '@mastra/core/workflows/legacy';
import { z } from 'zod';

// 初期値を提供するステップ
const startStep = new LegacyStep({
  id: 'start',
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async ({ context }) => {
    // トリガーのデータから値を取得
    const value = context.triggerData.inputValue;
    return { value };
  },
});

// 大きい値を処理するステップ
const highValueStep = new LegacyStep({
  id: 'highValue',
  outputSchema: z.object({
    result: z.string(),
  }),
  execute: async ({ context }) => {
    const value = context.getStepResult<{ value: number }>('start')?.value;
    return { result: `大きい値を処理しました: ${value}` };
  },
});

// 小さい値を処理するステップ
const lowValueStep = new LegacyStep({
  id: 'lowValue',
  outputSchema: z.object({
    result: z.string(),
  }),
  execute: async ({ context }) => {
    const value = context.getStepResult<{ value: number }>('start')?.value;
    return { result: `小さい値を処理しました: ${value}` };
  },
});

// 結果をまとめる最終ステップ
const finalStep = new LegacyStep({
  id: 'final',
  outputSchema: z.object({
    summary: z.string(),
  }),
  execute: async ({ context }) => {
    // 実行されたどちらの分岐からでも結果を取得
    const highResult = context.getStepResult<{ result: string }>('highValue')?.result;
    const lowResult = context.getStepResult<{ result: string }>('lowValue')?.result;

    const result = highResult || lowResult;
    return { summary: `処理完了: ${result}` };
  },
});

// 条件分岐付きのワークフローを構築
const conditionalWorkflow = new LegacyWorkflow({
  name: 'conditional-workflow',
  triggerSchema: z.object({
    inputValue: z.number(),
  }),
});

conditionalWorkflow
  .step(startStep)
  .if(async ({ context }) => {
    const value = context.getStepResult<{ value: number }>('start')?.value ?? 0;
    return value >= 10; // 条件: 値が10以上
  })
  .then(highValueStep)
  .then(finalStep)
  .else()
  .then(lowValueStep)
  .then(finalStep) // 両方の分岐は最終ステップで合流
  .commit();

// ワークフローを登録
const mastra = new Mastra({
  legacy_workflows: { conditionalWorkflow },
});

// 使用例
async function runWorkflow(inputValue: number) {
  const workflow = mastra.legacy_getWorkflow('conditionalWorkflow');
  const { start } = workflow.createRun();

  const result = await start({
    triggerData: { inputValue },
  });

  console.log('ワークフローの結果:', result.results);
  return result;
}

// 大きい値で実行（"if" 分岐に従う）
const result1 = await runWorkflow(15);
// 小さい値で実行（"else" 分岐に従う）
const result2 = await runWorkflow(5);

console.log('結果1:', result1);
console.log('結果2:', result2);
```

## 参照ベースの条件の使用 \{#using-reference-based-conditions\}

比較演算子を使った参照ベースの条件も利用できます。

```ts showLineNumbers copy
// 関数ではなく参照ベースの条件を使う
conditionalWorkflow
  .step(startStep)
  .if({
    ref: { step: startStep, path: 'value' },
    query: { $gte: 10 }, // 条件: 値が10以上
  })
  .then(highValueStep)
  .then(finalStep)
  .else()
  .then(lowValueStep)
  .then(finalStep)
  .commit();
```

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/workflows-legacy/conditional-branching"
}
/>

## ワークフロー（レガシー） \{#workflows-legacy\}

以下のリンクは、レガシー版ワークフローのドキュメント例です:

* [シンプルなワークフローの作成（レガシー）](/docs/examples/workflows_legacy/creating-a-workflow)
* [逐次ステップのワークフロー（レガシー）](/docs/examples/workflows_legacy/sequential-steps)
* [ステップの並列実行（レガシー）](/docs/examples/workflows_legacy/parallel-steps)
* [分岐パス（レガシー）](/docs/examples/workflows_legacy/branching-paths)
* [ワークフロー（レガシー）からのエージェント呼び出し](/docs/examples/workflows_legacy/calling-agent)
* [ツールをワークフローのステップとして使用（レガシー）](/docs/examples/workflows_legacy/using-a-tool-as-a-step)
* [循環依存を含むワークフロー（レガシー）](/docs/examples/workflows_legacy/cyclical-dependencies)
* [ワークフロー変数によるデータマッピング（レガシー）](/docs/examples/workflows_legacy/workflow-variables)
* [Human-in-the-Loop ワークフロー（レガシー）](/docs/examples/workflows_legacy/human-in-the-loop)
* [一時停止と再開に対応したワークフロー（レガシー）](/docs/examples/workflows_legacy/suspend-and-resume)