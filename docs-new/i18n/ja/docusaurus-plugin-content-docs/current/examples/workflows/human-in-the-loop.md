---
title: "Human-in-the-Loop（人間参加型）"
description: 人による介在ポイントを含むワークフローをMastraで作成する例。
---

# Human-in-the-Loop ワークフロー \{#human-in-the-loop-workflow\}

Human-in-the-Loop のワークフローを使うと、特定のステップで実行を一時停止し、人間による入力や意思決定、または自動化だけでは対応しきれない判断を要するタスクを行えます。

## ワークフローの一時停止 \{#suspend-workflow\}

この例では、ユーザーからの入力があるまでワークフローは停止します。処理は特定のステップで保留され、必要な確認が行われた時点でのみ再開されます。

```typescript filename="src/mastra/workflows/example-human-in-loop.ts" showLineNumbers copy
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
  description: 'ユーザーの確認まで一時停止します',
  inputSchema: z.object({
    value: z.number(),
  }),
  resumeSchema: z.object({
    confirm: z.boolean(),
  }),
  outputSchema: z.object({
    value: z.number(),
    confirmed: z.boolean().optional(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    const { value } = inputData;
    const { confirm } = resumeData ?? {};

    if (!confirm) {
      return await suspend({});
    }

    return { value: value, confirmed: confirm };
  },
});

export const humanInLoopWorkflow = createWorkflow({
  id: 'human-in-loop-workflow',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
})
  .then(step1)
  .then(step2)
  .commit();
```

## 関連項目 \{#related\}

* [ワークフローの実行](./running-workflows)

## ワークフロー（レガシー） \{#workflows-legacy\}

以下のリンクは、レガシーなワークフローに関するサンプルドキュメントです：

* [Human-in-the-Loop ワークフロー（レガシー）](/docs/examples/workflows_legacy/human-in-the-loop)