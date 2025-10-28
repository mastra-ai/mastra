---
title: "条件分岐"
description: "`branch` ステートメントを使って、Mastra のワークフローに条件分岐を作成する例。"
---

# 条件分岐 \{#conditional-branching\}

ワークフローは、条件に応じて異なる経路を取る必要がある場合がよくあります。以下の例では、`.branch()` を使って、ステップとワークフローの双方で条件付きフローを作成する方法を示します。

## ステップを用いた条件ロジック \{#conditional-logic-using-steps\}

この例では、ワークフローは条件に応じて2つのステップのうちいずれかを実行するために `.branch()` を使用します。入力の `value` が10以下の場合は `lessThanStep` を実行して `0` を返し、10より大きい場合は `greaterThanStep` を実行して `20` を返します。最初に条件に一致したブランチだけが実行され、その出力がワークフローの出力になります。

```typescript filename="src/mastra/workflows/example-branch-steps.ts" showLineNumbers copy
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

const lessThanStep = createStep({
  id: 'less-than-step',
  description: '値が10以下の場合は0を返す',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async () => {
    return {
      value: 0,
    };
  },
});
const greaterThanStep = createStep({
  id: 'greater-than-step',
  description: '値が10より大きい場合は20を返す',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async () => {
    return {
      value: 20,
    };
  },
});

export const branchSteps = createWorkflow({
  id: 'branch-workflow',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
})
  .branch([
    [async ({ inputData: { value } }) => value <= 10, lessThanStep],
    [async ({ inputData: { value } }) => value > 10, greaterThanStep],
  ])
  .commit();
```

> 入力値を10未満と10より大きい場合の両方で、この例を実行してみてください。

## ワークフローによる条件分岐 \{#conditional-logic-using-workflows\}

この例では、`.branch()` を使って条件に応じて 2 つのネストされたワークフローのいずれかを実行します。入力 `value` が 10 以下の場合は `lessThanWorkflow` を実行し、その中で `lessThanStep` が実行されます。値が 10 より大きい場合は `greaterThanWorkflow` を実行し、その中で `greaterThanStep` が実行されます。

```typescript filename="src/mastra/workflows/example-branch-workflows.ts" showLineNumbers copy
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

const lessThanStep = createStep({
  id: 'less-than-step',
  description: '値が10以下の場合は0を返す',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async () => {
    return {
      value: 0,
    };
  },
});
const greaterThanStep = createStep({
  id: 'greater-than-step',
  description: '値が10より大きい場合は20を返す',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async () => {
    return {
      value: 20,
    };
  },
});

export const lessThanWorkflow = createWorkflow({
  id: 'less-than-workflow',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
})
  .then(lessThanStep)
  .commit();

export const greaterThanWorkflow = createWorkflow({
  id: 'greater-than-workflow',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
})
  .then(greaterThanStep)
  .commit();

export const branchWorkflows = createWorkflow({
  id: 'branch-workflow',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
})
  .branch([
    [async ({ inputData: { value } }) => value <= 10, lessThanWorkflow],
    [async ({ inputData: { value } }) => value > 10, greaterThanWorkflow],
  ])
  .commit();
```

> 入力値を10未満または10より大きくして、この例を実行してください。

## 関連項目 \{#related\}

* [ワークフローの実行](./running-workflows)

## ワークフロー（レガシー） \{#workflows-legacy\}

以下のリンクは、レガシーワークフローに関するサンプルドキュメントです：

* [分岐パス](/docs/examples/workflows_legacy/branching-paths)
* [条件分岐付きワークフロー（レガシー、実験的）](/docs/examples/workflows_legacy/conditional-branching)