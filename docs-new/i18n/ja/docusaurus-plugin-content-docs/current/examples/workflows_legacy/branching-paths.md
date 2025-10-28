---
title: "分岐パス"
description: 中間結果に応じて分岐するレガシーなワークフローを、Mastra で作成する例。
---

# 分岐パス \{#branching-paths\}

データ処理では、中間結果に応じて異なる処理を行う必要があることがよくあります。次の例では、従来型のワークフローで分岐を作成し、各パスが前のステップの出力に基づいて異なるステップを実行する方法を示します。

## 制御フロー図 \{#control-flow-diagram\}

この例では、レガシーなワークフローが分岐して別々の経路に分かれ、各経路が前のステップの出力に応じて異なる手順を実行する方法を示します。

制御フロー図は次のとおりです。

<img src="/subscribed-chains.png" alt="分岐した経路を持つワークフローを示す図" />

## ステップの作成 \{#creating-the-steps\}

まずはステップを作成し、ワークフローを初期化しましょう。

```ts showLineNumbers copy
import { LegacyStep, LegacyWorkflow } from '@mastra/core/workflows/legacy';
import { z } from 'zod';

const stepOne = new LegacyStep({
  id: 'stepOne',
  execute: async ({ context }) => ({
    doubledValue: context.triggerData.inputValue * 2,
  }),
});

const stepTwo = new LegacyStep({
  id: 'stepTwo',
  execute: async ({ context }) => {
    const stepOneResult = context.getStepResult<{ doubledValue: number }>('stepOne');
    if (!stepOneResult) {
      return { isDivisibleByFive: false };
    }

    return { isDivisibleByFive: stepOneResult.doubledValue % 5 === 0 };
  },
});

const stepThree = new LegacyStep({
  id: 'stepThree',
  execute: async ({ context }) => {
    const stepOneResult = context.getStepResult<{ doubledValue: number }>('stepOne');
    if (!stepOneResult) {
      return { incrementedValue: 0 };
    }

    return { incrementedValue: stepOneResult.doubledValue + 1 };
  },
});

const stepFour = new LegacyStep({
  id: 'stepFour',
  execute: async ({ context }) => {
    const stepThreeResult = context.getStepResult<{ incrementedValue: number }>('stepThree');
    if (!stepThreeResult) {
      return { isDivisibleByThree: false };
    }

    return { isDivisibleByThree: stepThreeResult.incrementedValue % 3 === 0 };
  },
});

// 両方の分岐に依存する新しいステップ
const finalStep = new LegacyStep({
  id: 'finalStep',
  execute: async ({ context }) => {
    // getStepResult を使って両方の分岐の結果を取得
    const stepTwoResult = context.getStepResult<{ isDivisibleByFive: boolean }>('stepTwo');
    const stepFourResult = context.getStepResult<{ isDivisibleByThree: boolean }>('stepFour');

    const isDivisibleByFive = stepTwoResult?.isDivisibleByFive || false;
    const isDivisibleByThree = stepFourResult?.isDivisibleByThree || false;

    return {
      summary: `数値 ${context.triggerData.inputValue} は 2 倍にすると 5 で${isDivisibleByFive ? '割り切れ' : '割り切れません'}、さらに 2 倍した値に 1 を足すと 3 で${isDivisibleByThree ? '割り切れ' : '割り切れません'}。`,
      isDivisibleByFive,
      isDivisibleByThree,
    };
  },
});

// ワークフローを作成する
const myWorkflow = new LegacyWorkflow({
  name: 'my-workflow',
  triggerSchema: z.object({
    inputValue: z.number(),
  }),
});
```

## 分岐パスとステップの連結 \{#branching-paths-and-chaining-steps\}

ここでは、分岐パスを持つレガシーなワークフローを設定し、複合的な `.after([])` 構文を使ってそれらを統合します。

```ts showLineNumbers copy
// 2 つの並列ブランチを作成する
myWorkflow
  // 第1ブランチ
  .step(stepOne)
  .then(stepTwo)

  // 第2ブランチ
  .after(stepOne)
  .step(stepThree)
  .then(stepFour)

  // 複合的な after 構文で両ブランチをマージする
  .after([stepTwo, stepFour])
  .step(finalStep)
  .commit();

const { start } = myWorkflow.createRun();

const result = await start({ triggerData: { inputValue: 3 } });
console.log(result.steps.finalStep.output.summary);
// 出力: "数値 3 は 2 倍にすると 5 で割り切れず、2 倍にして 1 を足すと 3 で割り切れます。"
```

## 高度なブランチとマージ \{#advanced-branching-and-merging\}

複数のブランチとマージポイントを組み合わせて、より複雑なワークフローを構築できます。

```ts showLineNumbers copy
const complexWorkflow = new LegacyWorkflow({
  name: 'complex-workflow',
  triggerSchema: z.object({
    inputValue: z.number(),
  }),
});

// 複数の分岐を作成し、異なるマージポイントを設定
complexWorkflow
  // メインステップ
  .step(stepOne)

  // 第1分岐
  .then(stepTwo)

  // 第2分岐
  .after(stepOne)
  .step(stepThree)
  .then(stepFour)

  // 第3分岐（stepOne からの別ルート）
  .after(stepOne)
  .step(
    new LegacyStep({
      id: 'alternativePath',
      execute: async ({ context }) => {
        const stepOneResult = context.getStepResult<{ doubledValue: number }>('stepOne');
        return {
          result: (stepOneResult?.doubledValue || 0) * 3,
        };
      },
    }),
  )

  // 第1分岐と第2分岐をマージ
  .after([stepTwo, stepFour])
  .step(
    new LegacyStep({
      id: 'partialMerge',
      execute: async ({ context }) => {
        const stepTwoResult = context.getStepResult<{
          isDivisibleByFive: boolean;
        }>('stepTwo');
        const stepFourResult = context.getStepResult<{
          isDivisibleByThree: boolean;
        }>('stepFour');

        return {
          intermediateResult: '最初の2つの分岐を処理しました',
          branchResults: {
            branch1: stepTwoResult?.isDivisibleByFive,
            branch2: stepFourResult?.isDivisibleByThree,
          },
        };
      },
    }),
  )

  // すべての分岐を最終的にマージ
  .after(['partialMerge', 'alternativePath'])
  .step(
    new LegacyStep({
      id: 'finalMerge',
      execute: async ({ context }) => {
        const partialMergeResult = context.getStepResult<{
          intermediateResult: string;
          branchResults: { branch1: boolean; branch2: boolean };
        }>('partialMerge');

        const alternativePathResult = context.getStepResult<{ result: number }>('alternativePath');

        return {
          finalResult: 'すべての分岐を処理しました',
          combinedData: {
            fromPartialMerge: partialMergeResult?.branchResults,
            fromAlternativePath: alternativePathResult?.result,
          },
        };
      },
    }),
  )
  .commit();
```

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/workflows-legacy/workflow-with-branching-paths"
}
/>

`

## ワークフロー（レガシー） \{#workflows-legacy\}

以下のリンクは、レガシー版ワークフローのドキュメント例です。

* [シンプルなワークフローの作成（レガシー）](/docs/examples/workflows_legacy/creating-a-workflow)
* [順次ステップのワークフロー（レガシー）](/docs/examples/workflows_legacy/sequential-steps)
* [ステップによる並列実行（レガシー）](/docs/examples/workflows_legacy/parallel-steps)
* [条件分岐付きワークフロー（レガシー・実験的）](/docs/examples/workflows_legacy/conditional-branching)
* [ワークフロー（レガシー）からのエージェント呼び出し](/docs/examples/workflows_legacy/calling-agent)
* [ツールをワークフローのステップとして使用（レガシー）](/docs/examples/workflows_legacy/using-a-tool-as-a-step)
* [循環依存を含むワークフロー（レガシー）](/docs/examples/workflows_legacy/cyclical-dependencies)
* [ワークフロー変数によるデータマッピング（レガシー）](/docs/examples/workflows_legacy/workflow-variables)
* [Human-in-the-Loop ワークフロー（レガシー）](/docs/examples/workflows_legacy/human-in-the-loop)
* [一時停止と再開に対応したワークフロー（レガシー）](/docs/examples/workflows_legacy/suspend-and-resume)