---
title: "順次ステップ"
description: Mastra を使ってレガシーなワークフローのステップを特定の順序で連結し、ステップ間でデータを受け渡す例。
---

# 連続ステップによるワークフロー（レガシー） \{#workflow-legacy-with-sequential-steps\}

ワークフローは、特定の順序で連結して順番に実行できます。

## 制御フローダイアグラム \{#control-flow-diagram\}

この例では、`then` メソッドを使ってワークフローのステップを連結し、連続するステップ間でデータを受け渡して、所定の順序で実行する方法を示します。

制御フローダイアグラムは次のとおりです。

<img src="/sequential-chains.png" alt="連続するステップを持つワークフローを示すダイアグラム" width={600} />

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
  execute: async ({ context }) => {
    if (context.steps.stepTwo.status !== 'success') {
      return { tripledValue: 0 };
    }

    return { tripledValue: context.steps.stepTwo.output.incrementedValue * 3 };
  },
});

// ワークフローを構築
const myWorkflow = new LegacyWorkflow({
  name: 'my-workflow',
  triggerSchema: z.object({
    inputValue: z.number(),
  }),
});
```

## ステップを連結してワークフローを実行する \{#chaining-the-steps-and-executing-the-workflow\}

それでは、ステップを連結していきましょう。

```ts showLineNumbers copy
// 順次ステップ
myWorkflow.step(stepOne).then(stepTwo).then(stepThree);

myWorkflow.commit();

const { start } = myWorkflow.createRun();

const res = await start({ triggerData: { inputValue: 90 } });
```

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/workflows-legacy/workflow-with-sequential-steps"
}
/>

## ワークフロー（レガシー） \{#workflows-legacy\}

以下のリンクは、レガシー版ワークフローの例示ドキュメントです：

* [シンプルなワークフローの作成（レガシー）](/docs/examples/workflows_legacy/creating-a-workflow)
* [ステップの並列実行](/docs/examples/workflows_legacy/parallel-steps)
* [分岐パス](/docs/examples/workflows_legacy/branching-paths)
* [条件分岐付きワークフロー（レガシー、実験的）](/docs/examples/workflows_legacy/conditional-branching)
* [ワークフロー（レガシー）からのエージェント呼び出し](/docs/examples/workflows_legacy/calling-agent)
* [ワークフローのステップとしてツールを使用（レガシー）](/docs/examples/workflows_legacy/using-a-tool-as-a-step)
* [循環依存関係のあるワークフロー（レガシー）](/docs/examples/workflows_legacy/cyclical-dependencies)
* [ワークフロー変数によるデータマッピング（レガシー）](/docs/examples/workflows_legacy/workflow-variables)
* [Human-in-the-Loop（人手介在）ワークフロー（レガシー）](/docs/examples/workflows_legacy/human-in-the-loop)
* [一時停止と再開に対応したワークフロー（レガシー）](/docs/examples/workflows_legacy/suspend-and-resume)