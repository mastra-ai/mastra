---
title: "循環依存"
description: Mastra を使って、循環依存や条件付きループを含むレガシーなワークフローを作成する例。
---

# ワークフロー（レガシー）の循環依存 \{#workflow-legacy-with-cyclical-dependencies\}

ワークフローでは、条件に応じてステップを元に戻してループさせるような循環依存をサポートしています。以下の例では、条件分岐ロジックを用いてループを作成し、繰り返し実行を処理する方法を示します。

```ts showLineNumbers copy
import { LegacyWorkflow, LegacyStep } from '@mastra/core/workflows/legacy';
import { z } from 'zod';

async function main() {
  const doubleValue = new LegacyStep({
    id: 'doubleValue',
    description: '入力値を2倍にします',
    inputSchema: z.object({
      inputValue: z.number(),
    }),
    outputSchema: z.object({
      doubledValue: z.number(),
    }),
    execute: async ({ context }) => {
      const doubledValue = context.inputValue * 2;
      return { doubledValue };
    },
  });

  const incrementByOne = new LegacyStep({
    id: 'incrementByOne',
    description: '入力値に1を加算します',
    outputSchema: z.object({
      incrementedValue: z.number(),
    }),
    execute: async ({ context }) => {
      const valueToIncrement = context?.getStepResult<{ firstValue: number }>('trigger')?.firstValue;
      if (!valueToIncrement) throw new Error('増分する値が指定されていません');
      const incrementedValue = valueToIncrement + 1;
      return { incrementedValue };
    },
  });

  const cyclicalWorkflow = new LegacyWorkflow({
    name: 'cyclical-workflow',
    triggerSchema: z.object({
      firstValue: z.number(),
    }),
  });

  cyclicalWorkflow
    .step(doubleValue, {
      variables: {
        inputValue: {
          step: 'trigger',
          path: 'firstValue',
        },
      },
    })
    .then(incrementByOne)
    .after(doubleValue)
    .step(doubleValue, {
      variables: {
        inputValue: {
          step: doubleValue,
          path: 'doubledValue',
        },
      },
    })
    .commit();

  const { runId, start } = cyclicalWorkflow.createRun();

  console.log('実行', runId);

  const res = await start({ triggerData: { firstValue: 6 } });

  console.log(res.results);
}

main();
```

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/workflows-legacy/workflow-with-cyclical-deps"
}
/>

## ワークフロー（レガシー） \{#workflows-legacy\}

以下のリンクは、レガシー版ワークフローのドキュメント例です：

* [シンプルなワークフローの作成（レガシー）](/docs/examples/workflows_legacy/creating-a-workflow)
* [順次ステップのワークフロー（レガシー）](/docs/examples/workflows_legacy/sequential-steps)
* [ステップの並列実行（レガシー）](/docs/examples/workflows_legacy/parallel-steps)
* [分岐パス（レガシー）](/docs/examples/workflows_legacy/branching-paths)
* [条件分岐付きワークフロー（レガシー／実験的）](/docs/examples/workflows_legacy/conditional-branching)
* [ワークフロー（レガシー）からのエージェント呼び出し](/docs/examples/workflows_legacy/calling-agent)
* [ツールをワークフローのステップとして使用（レガシー）](/docs/examples/workflows_legacy/using-a-tool-as-a-step)
* [ワークフロー変数によるデータマッピング（レガシー）](/docs/examples/workflows_legacy/workflow-variables)
* [Human-in-the-Loop ワークフロー（レガシー）](/docs/examples/workflows_legacy/human-in-the-loop)
* [一時停止と再開が可能なワークフロー（レガシー）](/docs/examples/workflows_legacy/suspend-and-resume)