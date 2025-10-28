---
title: "一時停止と再開"
description: "Mastra のワークフローでは、外部からの入力やリソースを待つ間、実行を一時停止し、必要に応じて再開できます。"
sidebar_position: 4
---

# 一時停止と再開 \{#suspend-resume\}

ワークフローは任意のステップで一時停止でき、現在の状態はストレージにスナップショットとして永続化されます。準備が整い次第、この保存済みスナップショットから実行を再開できます。スナップショットを永続化しておくことで、セッション、デプロイ、サーバー再起動をまたいでもワークフローの状態が保たれます。これは、外部からの入力やリソースを待つあいだ一時停止が続く可能性のあるワークフローに不可欠です。

ワークフローを一時停止する一般的なシナリオ:

* 人による承認や入力を待つ
* 外部の API リソースが利用可能になるまで停止して待機する
* 後続ステップに必要な追加データを収集する
* コストの高い処理に対してレート制限やスロットリングを行う
* 外部トリガーを伴うイベント駆動型の処理に対応する

> 一時停止と再開は初めてですか？公式の動画チュートリアルをご覧ください:
>
> * [Mastering Human-in-the-Loop with Suspend &amp; Resume](https://youtu.be/aORuNG8Tq_k) - ワークフローを一時停止し、ユーザー入力を受け付ける方法を学ぶ
> * [Building Multi-Turn Chat Interfaces with React](https://youtu.be/UMVm8YZwlxc) - React のチャットインターフェースで人を交えたマルチターン対話を実装する

## ワークフローのステータスタイプ \{#workflow-status-types\}

ワークフローを実行しているとき、その`status`は次のいずれかになります。

* `running` - ワークフローが実行中
* `suspended` - ワークフローが一時停止中
* `success` - ワークフローが完了
* `failed` - ワークフローが失敗

## `suspend()` を使ってワークフローを一時停止する \{#suspending-a-workflow-with-suspend\}

特定のステップでユーザー入力を待つために処理を一時停止するには、`⁠suspend` 関数を使用してワークフローを一時的に停止し、必要なデータが提供されたときにのみ再開されるようにします。

![suspend() を使ってワークフローを一時停止する](/img/workflows/workflows-suspend-resume-suspend.jpg)

```typescript {16} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
const step1 = createStep({
  id: 'step-1',
  inputSchema: z.object({
    input: z.string(),
  }),
  outputSchema: z.object({
    output: z.string(),
  }),
  resumeSchema: z.object({
    city: z.string(),
  }),
  execute: async ({ resumeData, suspend }) => {
    const { city } = resumeData ?? {};

    if (!city) {
      return await suspend({});
    }

    return { output: '' };
  },
});

export const testWorkflow = createWorkflow({
  // ...
})
  .then(step1)
  .commit();
```

> 詳細は、[Suspend workflow の例](/docs/examples/workflows/human-in-the-loop#suspend-workflow)をご覧ください。

### 一時停止されたステップの特定 \{#identifying-suspended-steps\}

一時停止中のワークフローを再開するには、結果の `suspended` 配列を確認し、どのステップが入力を必要としているかを特定します。

```typescript {15} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { mastra } from './mastra';

const run = await mastra.getWorkflow('testWorkflow').createRunAsync();

const result = await run.start({
  inputData: {
    city: 'London',
  },
});

console.log(JSON.stringify(result, null, 2));

if (result.status === 'suspended') {
  const resumedResult = await run.resume({
    step: result.suspended[0],
    resumeData: {
      city: 'ベルリン',
    },
  });
}
```

この場合、ロジックは `suspended` 配列に記載された最初のステップから再開されます。`step` はその `id` で指定することもでき、例えば「step-1」のように指定します。

```json
{
  "status": "一時停止",
  "steps": {
    // ...
    "step-1": {
      // ...
      "status": "一時停止",
    }
  },
  "suspended": [["step-1"]]
}
```

> 詳細は [Run Workflow Results](./overview#run-workflow-results) をご参照ください。

## suspend を使ってユーザーにフィードバックを提供する \{#providing-user-feedback-with-suspend\}

ワークフローがサスペンドされると、`suspendSchema` を通じてユーザーにフィードバックを表示できます。ワークフローが一時停止した理由を説明するために、`suspend` のペイロードに理由を含めてください。

```typescript {13,23} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

const step1 = createStep({
  id: 'step-1',
  inputSchema: z.object({
    value: z.string(),
  }),
  resumeSchema: z.object({
    confirm: z.boolean(),
  }),
  suspendSchema: z.object({
    reason: z.string(),
  }),
  outputSchema: z.object({
    value: z.string(),
  }),
  execute: async ({ resumeData, suspend }) => {
    const { confirm } = resumeData ?? {};

    if (!confirm) {
      return await suspend({
        reason: '続行するには確認が必要です',
      });
    }

    return { value: '' };
  },
});

export const testWorkflow = createWorkflow({
  // ...
})
  .then(step1)
  .commit();
```

この場合、提示された理由は、続行するにはユーザーの確認が必要であることを説明しています。

```json
{
  "step-1": {
    // ...
    "status": "保留中",
    "suspendPayload": {
      "reason": "続行するには確認が必要です"
    }
  }
}
```

> 詳細は「[Run Workflow Results](./overview#run-workflow-results)」を参照してください。

## `resume()` を使ってワークフローを再開する \{#resuming-a-workflow-with-resume\}

ワークフローは `resume` を呼び出し、必要な `resumeData` を渡すことで再開できます。どのステップから再開するかを明示的に指定することもできますし、ちょうど1つのステップだけが一時停止されている場合は `step` パラメータを省略すれば、そのステップが自動的に再開されます。

```typescript {16-18} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { mastra } from './mastra';

const run = await mastra.getWorkflow('testWorkflow').createRunAsync();

const result = await run.start({
  inputData: {
    city: 'London',
  },
});

console.log(JSON.stringify(result, null, 2));

if (result.status === 'suspended') {
  const resumedResult = await run.resume({
    step: 'step-1',
    resumeData: {
      city: 'Berlin',
    },
  });

  console.log(JSON.stringify(resumedResult, null, 2));
}
```

サスペンドされているステップがちょうど1つだけなら、`step` パラメータは省略できます。

```typescript {5} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
const resumedResult = await run.resume({
  resumeData: {
    city: 'Berlin',
  },
  // step パラメータは省略 — 一時停止中の単一ステップを自動的に再開します
});
```

### 入れ子ワークフローの再開 \{#resuming-nested-workflows\}

一時停止中の入れ子ワークフローを再開するには、`resume` 関数の `step` パラメータにワークフロー インスタンスを渡します。

```typescript {33-34} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
const dowhileWorkflow = createWorkflow({
  id: 'dowhile-workflow',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ value: z.number() }),
})
  .dountil(
    createWorkflow({
      id: 'simple-resume-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      steps: [incrementStep, resumeStep],
    })
      .then(incrementStep)
      .then(resumeStep)
      .commit(),
    async ({ inputData }) => inputData.value >= 10,
  )
  .then(
    createStep({
      id: 'final',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: async ({ inputData }) => ({ value: inputData.value }),
    }),
  )
  .commit();

const run = await dowhileWorkflow.createRunAsync();
const result = await run.start({ inputData: { value: 0 } });

if (result.status === 'suspended') {
  const resumedResult = await run.resume({
    resumeData: { value: 2 },
    step: ['simple-resume-workflow', 'resume'],
  });

  console.log(JSON.stringify(resumedResult, null, 2));
}
```

## suspend/resume での `RuntimeContext` の使用 \{#using-runtimecontext-with-suspendresume\}

`suspend/resume` を `RuntimeContext` と併用する場合、インスタンスは自分で作成し、`start` と `resume` の各関数に渡します。
`RuntimeContext` はワークフローの実行内で自動的に共有されません。

```typescript {1,4,9,16} filename="src/mastra/workflows/test-workflow.tss" showLineNumbers copy
import { RuntimeContext } from '@mastra/core/di';
import { mastra } from './mastra';

const runtimeContext = new RuntimeContext();
const run = await mastra.getWorkflow('testWorkflow').createRunAsync();

const result = await run.start({
  inputData: { suggestions: ['ロンドン', 'パリ', 'ニューヨーク'] },
  runtimeContext,
});

if (result.status === 'suspended') {
  const resumedResult = await run.resume({
    step: 'step-1',
    resumeData: { city: 'ニューヨーク' },
    runtimeContext,
  });
}
```
