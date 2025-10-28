---
title: "ワークフローからエージェントを呼び出す（レガシー）"
description: レガシーなワークフローのステップ内でMastraを使ってAIエージェントを呼び出す例。
---

# ワークフローからエージェントを呼び出す（レガシー） \{#calling-an-agent-from-a-workflow-legacy\}

この例では、メッセージを処理して応答を生成する AI エージェントを呼び出し、レガシーのワークフロー手順内で実行するレガシー ワークフローの作成方法を示します。

```ts showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { LegacyStep, LegacyWorkflow } from '@mastra/core/workflows/legacy';
import { z } from 'zod';

const penguin = new Agent({
  name: 'エージェント・スキッパー',
  instructions: `あなたは「マダガスカルのペンギン」のスキッパーです。そのキャラクターになりきって返答してください`,
  model: openai('gpt-4o-mini'),
});

const newWorkflow = new LegacyWorkflow({
  name: 'ワークフローへメッセージを渡す',
  triggerSchema: z.object({
    message: z.string(),
  }),
});

const replyAsSkipper = new LegacyStep({
  id: 'reply',
  outputSchema: z.object({
    reply: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    const skipper = mastra?.getAgent('penguin');

    const res = await skipper?.generate(context?.triggerData?.message);
    return { reply: res?.text || '' };
  },
});

newWorkflow.step(replyAsSkipper);
newWorkflow.commit();

const mastra = new Mastra({
  agents: { penguin },
  legacy_workflows: { newWorkflow },
});

const { runId, start } = await mastra.legacy_getWorkflow('newWorkflow').createRun();

const runResult = await start({
  triggerData: { message: 'プライベート救出作戦の概要を教えてくれ' },
});

console.log(runResult.results);
```

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/blob/main/examples/basics/workflows-legacy/calling-agent-from-workflow"
}
/>

## ワークフロー（レガシー） \{#workflows-legacy\}

以下のリンクは、レガシー版ワークフローの例を示すドキュメントです：

* [シンプルなワークフローの作成（レガシー）](/docs/examples/workflows_legacy/creating-a-workflow)
* [順次ステップのワークフロー（レガシー）](/docs/examples/workflows_legacy/sequential-steps)
* [ステップの並列実行（レガシー）](/docs/examples/workflows_legacy/parallel-steps)
* [分岐パス（レガシー）](/docs/examples/workflows_legacy/branching-paths)
* [条件分岐付きワークフロー（実験的、レガシー）](/docs/examples/workflows_legacy/conditional-branching)
* [ツールをワークフローのステップとして使用（レガシー）](/docs/examples/workflows_legacy/using-a-tool-as-a-step)
* [循環依存のあるワークフロー（レガシー）](/docs/examples/workflows_legacy/cyclical-dependencies)
* [ワークフロー変数によるデータマッピング（レガシー）](/docs/examples/workflows_legacy/workflow-variables)
* [Human-in-the-Loop ワークフロー（レガシー）](/docs/examples/workflows_legacy/human-in-the-loop)
* [中断と再開が可能なワークフロー（レガシー）](/docs/examples/workflows_legacy/suspend-and-resume)