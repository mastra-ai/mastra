---
title: "順次実行"
description: ワークフロー内で複数の独立したタスクを順番に実行するために Mastra を使用する例。
---

# 逐次実行 \{#sequential-execution\}

多くのワークフローでは、定められた順序で手順を順に実行します。次の例では、`.then()` を用いて、ある手順の出力を次の手順の入力として受け渡す、シンプルな逐次ワークフローの構築方法を示します。

## ステップによる順次実行 \{#sequential-execution-using-steps\}

この例では、ワークフローは `step1` と `step2` を順番に実行し、各ステップに入力を渡して処理を行い、最終的な結果を `step2` から返します。

```typescript filename="src/mastra/workflows/example-sequential-steps.ts" showLineNumbers copy
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

export const sequentialSteps = createWorkflow({
  id: 'sequential-workflow',
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

## 関連情報 \{#related\}

* [ワークフローの実行](./running-workflows)