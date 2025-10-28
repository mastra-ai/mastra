---
title: "ワークフローの作成"
description: Mastra を使って、1 つのステップからなるシンプルなワークフローを定義し実行する例。
---

# シンプルなワークフローの作成（レガシー） \{#creating-a-simple-workflow-legacy\}

ワークフローでは、構造化された手順に沿って一連の処理を定義し、実行できます。次の例では、1ステップのみのレガシー ワークフローを示します。

```ts showLineNumbers copy
import { LegacyStep, LegacyWorkflow } from '@mastra/core/workflows/legacy';
import { z } from 'zod';

const myWorkflow = new LegacyWorkflow({
  name: 'my-workflow',
  triggerSchema: z.object({
    input: z.number(),
  }),
});

const stepOne = new LegacyStep({
  id: 'stepOne',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    doubledValue: z.number(),
  }),
  execute: async ({ context }) => {
    const doubledValue = context?.triggerData?.input * 2;
    return { doubledValue };
  },
});

myWorkflow.step(stepOne).commit();

const { runId, start } = myWorkflow.createRun();

const res = await start({
  triggerData: { input: 90 },
});

console.log(res.results);
```

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/workflows-legacy/create-workflow"
}
/>

## ワークフロー（レガシー） \{#workflows-legacy\}

以下は、レガシー版ワークフローのドキュメント例です：

* [ワークフロー（レガシー）の逐次ステップ](/docs/examples/workflows_legacy/sequential-steps)
* [ステップを用いた並列実行](/docs/examples/workflows_legacy/parallel-steps)
* [分岐パス](/docs/examples/workflows_legacy/branching-paths)
* [ワークフロー（レガシー）の条件分岐（試験的）](/docs/examples/workflows_legacy/conditional-branching)
* [ワークフロー（レガシー）からのエージェント呼び出し](/docs/examples/workflows_legacy/calling-agent)
* [ツールをワークフローのステップとして使用（レガシー）](/docs/examples/workflows_legacy/using-a-tool-as-a-step)
* [循環依存のあるワークフロー（レガシー）](/docs/examples/workflows_legacy/cyclical-dependencies)
* [ワークフロー変数によるデータマッピング（レガシー）](/docs/examples/workflows_legacy/workflow-variables)
* [Human-in-the-Loop ワークフロー（レガシー）](/docs/examples/workflows_legacy/human-in-the-loop)
* [一時停止と再開に対応したワークフロー（レガシー）](/docs/examples/workflows_legacy/suspend-and-resume)