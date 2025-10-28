---
title: "並列実行"
description: ワークフロー内で複数の独立したタスクを並行して実行するために Mastra を使用する例。
---

# ステップによる並列実行 \{#parallel-execution-with-steps\}

AIアプリケーションを構築する際には、効率を高めるために複数の独立したタスクを同時に処理する必要が生じることがよくあります。

## 制御フローダイアグラム \{#control-flow-diagram\}

この例では、各ブランチがそれぞれのデータフローと依存関係を扱いながら、手順を並列で実行するワークフローの構成方法を示します。

制御フローダイアグラムは次のとおりです。

<img src="/parallel-chains.png" alt="並列ステップを含むワークフローを示すダイアグラム" width={600} />

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
    if (context.steps.stepOne.status !== 'success') {
      return { incrementedValue: 0 };
    }

    return { incrementedValue: context.steps.stepOne.output.doubledValue + 1 };
  },
});

const stepThree = new LegacyStep({
  id: 'stepThree',
  execute: async ({ context }) => ({
    tripledValue: context.triggerData.inputValue * 3,
  }),
});

const stepFour = new LegacyStep({
  id: 'stepFour',
  execute: async ({ context }) => {
    if (context.steps.stepThree.status !== 'success') {
      return { isEven: false };
    }

    return { isEven: context.steps.stepThree.output.tripledValue % 2 === 0 };
  },
});

const myWorkflow = new LegacyWorkflow({
  name: 'my-workflow',
  triggerSchema: z.object({
    inputValue: z.number(),
  }),
});
```

## ステップの連結と並列化 \{#chaining-and-parallelizing-steps\}

ここでワークフローにステップを追加できます。`.then()` メソッドはステップを連結するために使われますが、`.step()` メソッドはステップをワークフローに追加するために使われる点に注意してください。

```ts showLineNumbers copy
myWorkflow
  .step(stepOne)
  .then(stepTwo) // チェーン1
  .step(stepThree)
  .then(stepFour) // チェーン2
  .commit();

const { start } = myWorkflow.createRun();

const result = await start({ triggerData: { inputValue: 3 } });
```

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/workflows-legacy/workflow-with-parallel-steps"
}
/>

## ワークフロー（レガシー） \{#workflows-legacy\}

以下のリンクは、レガシー版ワークフローの例のドキュメントです：

* [シンプルなワークフローの作成（レガシー）](/docs/examples/workflows_legacy/creating-a-workflow)
* [逐次ステップのワークフロー（レガシー）](/docs/examples/workflows_legacy/sequential-steps)
* [分岐パス](/docs/examples/workflows_legacy/branching-paths)
* [条件分岐（実験的）のワークフロー（レガシー）](/docs/examples/workflows_legacy/conditional-branching)
* [ワークフロー（レガシー）からのエージェント呼び出し](/docs/examples/workflows_legacy/calling-agent)
* [ツールをワークフローのステップとして使用（レガシー）](/docs/examples/workflows_legacy/using-a-tool-as-a-step)
* [循環依存関係のあるワークフロー（レガシー）](/docs/examples/workflows_legacy/cyclical-dependencies)
* [ワークフロー変数によるデータマッピング（レガシー）](/docs/examples/workflows_legacy/workflow-variables)
* [Human-in-the-Loop ワークフロー（レガシー）](/docs/examples/workflows_legacy/human-in-the-loop)
* [一時停止と再開に対応したワークフロー（レガシー）](/docs/examples/workflows_legacy/suspend-and-resume)