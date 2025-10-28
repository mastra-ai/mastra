---
title: "並列実行"
description: ワークフロー内で複数の独立したタスクを並行して実行するために Mastra を用いる例。
---

# 並行実行 \{#parallel-execution\}

ワークフローでは、同時に複数の処理を実行する必要があることがよくあります。以下の例では、`.parallel()` を使ってステップやワークフローを並行実行し、その結果を統合する方法を示します。

## ステップを使った並列実行 \{#parallel-execution-using-steps\}

この例では、ワークフローは `.parallel()` を使って `step1` と `step2` を実行します。各ステップは同じ入力を受け取り、独立して実行されます。各ステップの出力はステップの `id` ごとに名前空間化され、まとめて `step3` に渡されます。`step3` は結果を統合して最終的な値を返します。

```typescript filename="src/mastra/workflows/example-parallel-steps.ts" showLineNumbers copy
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

const step1 = createStep({
  id: 'step-1',
  description: '入力値を出力に渡す',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { value } = inputData;
    return {
      value,
    };
  },
});

const step2 = createStep({
  id: 'step-2',
  description: '入力値を出力に渡す',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { value } = inputData;
    return {
      value,
    };
  },
});

const step3 = createStep({
  id: 'step-3',
  description: 'step-1とstep-2の値を合計',
  inputSchema: z.object({
    'step-1': z.object({ value: z.number() }),
    'step-2': z.object({ value: z.number() }),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async ({ inputData }) => {
    return {
      value: inputData['step-1'].value + inputData['step-2'].value,
    };
  },
});

export const parallelSteps = createWorkflow({
  id: 'parallel-workflow',
  description: 'ステップを並列実行し、最終ステップを実行するワークフロー',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
})
  .parallel([step1, step2])
  .then(step3)
  .commit();
```

## ワークフローを用いた並列実行 \{#parallel-execution-using-workflows\}

この例では、`.parallel()` を使って `workflow1` と `workflow2` の2つのワークフローを同時に実行します。各ワークフローには、入力値をそのまま返す単一のステップが含まれています。各出力はワークフローの `id` を名前空間として付与され、`step3` に渡されて結果が統合され、最終的な値が返されます。

```typescript filename="src/mastra/workflows/example-parallel-workflows.ts" showLineNumbers copy
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

const step1 = createStep({
  id: 'step-1',
  description: '入力から出力に値を渡します',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { value } = inputData;
    return {
      value,
    };
  },
});

const step2 = createStep({
  id: 'step-2',
  description: '入力から出力に値を渡します',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { value } = inputData;
    return {
      value,
    };
  },
});

const step3 = createStep({
  id: 'step-3',
  description: 'step-1とstep-2の値を合計します',
  inputSchema: z.object({
    'workflow-1': z.object({ value: z.number() }),
    'workflow-2': z.object({ value: z.number() }),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async ({ inputData }) => {
    return {
      value: inputData['workflow-1'].value + inputData['workflow-2'].value,
    };
  },
});

export const workflow1 = createWorkflow({
  id: 'workflow-1',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
})
  .then(step1)
  .commit();

export const workflow2 = createWorkflow({
  id: 'workflow-2',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
})
  .then(step2)
  .commit();

export const parallelWorkflows = createWorkflow({
  id: 'parallel-workflow',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
})
  .parallel([workflow1, workflow2])
  .then(step3)
  .commit();
```

## 関連項目 \{#related\}

* [ワークフローを実行する](./running-workflows)

## ワークフロー（レガシー） \{#workflows-legacy\}

以下のリンクは、レガシーワークフローのドキュメント例です。

* [ステップを用いた並列実行](/docs/examples/workflows_legacy/parallel-steps)