---
title: "エラー処理"
description: "Mastra のワークフローにおけるエラー処理を、ステップの再試行、条件分岐、監視を用いて学びます。"
sidebar_position: 5
---

# エラー処理 \{#error-handling\}

Mastra には、一時的なエラーで失敗したワークフローやステップを対象にした組み込みのリトライ機構が用意されています。これは、一時的にサービスやリソースが利用できなくなる可能性のある外部システムとやり取りするステップで特に有効です。

## ワークフロー レベルでの `retryConfig` の使用 \{#workflow-level-using-retryconfig\}

ワークフロー内のすべてのステップに適用されるよう、リトライをワークフロー レベルで設定できます。

```typescript {8-11} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({...});

export const testWorkflow = createWorkflow({
  // 省略
  retryConfig: {
    attempts: 5,
    delay: 2000
  }
})
  .then(step1)
  .commit();
```

## `retries` を使ったステップ単位のリトライ設定 \{#step-level-using-retries\}

各ステップごとに `retries` プロパティでリトライを設定できます。これにより、そのステップに限ってワークフローレベルのリトライ設定が上書きされます。

```typescript {17} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({
  // ...
  execute: async () => {
    const response = await // ...

    if (!response.ok) {
      throw new Error('エラー');
    }

    return {
      value: ""
    };
  },
  retries: 3
});
```

## 条件分岐 \{#conditional-branching\}

条件ロジックを使用し、前のステップの成否に応じて代替のワークフロー経路を作成できます。

```typescript {15,19,33-34} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({
  // ...
  execute: async () => {
    try {
      const response = await // ...

      if (!response.ok) {
        throw new Error('error');
      }

      return {
        status: "ok"
      };
    } catch (error) {
      return {
        status: "error"
      };
    }
  }
});

const step2 = createStep({...});
const fallback = createStep({...});

export const testWorkflow = createWorkflow({
  // ...
})
  .then(step1)
  .branch([
    [async ({ inputData: { status } }) => status === "ok", step2],
    [async ({ inputData: { status } }) => status === "error", fallback]
  ])
  .commit();
```

## 前のステップの結果を確認する \{#check-previous-step-results\}

`getStepResult()` を使用して、前のステップの結果を確認します。

```typescript {10} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({...});

const step2 = createStep({
  // ...
  execute: async ({ getStepResult }) => {

    const step1Result = getStepResult(step1);

    return {
      value: ""
    };
  }
});
```

## `bail()` で早期終了する \{#exiting-early-with-bail\}

ステップ内で `bail()` を使うと、成功として早期終了できます。指定したペイロードがステップの出力として返され、ワークフローの実行は終了します。

```typescript {7} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({
  id: 'step1',
  execute: async ({ bail }) => {
    return bail({ result: '中断' });
  },
  inputSchema: z.object({ value: z.string() }),
  outputSchema: z.object({ result: z.string() }),
});

export const testWorkflow = createWorkflow({...})
  .then(step1)
  .commit();
```

## `Error()` で早期終了する \{#exiting-early-with-error\}

エラーで終了するには、ステップ内で `throw new Error()` を使用します。

```typescript {7} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({
  id: 'step1',
  execute: async () => {
    throw new Error('エラーが発生しました');
  },
  inputSchema: z.object({ value: z.string() }),
  outputSchema: z.object({ result: z.string() }),
});

export const testWorkflow = createWorkflow({...})
  .then(step1)
  .commit();
```

## `watch()` でエラーを監視する \{#monitor-errors-with-watch\}

`watch` メソッドを使うと、ワークフローのエラーを監視できます。

```typescript {11} filename="src/test-workflow.ts" showLineNumbers copy
import { mastra } from '../src/mastra';

const workflow = mastra.getWorkflow('testWorkflow');
const run = await workflow.createRunAsync();

run.watch(event => {
  const {
    payload: { currentStep },
  } = event;

  console.log(currentStep?.payload?.status);
});
```

## `stream()` でエラーを監視する

`stream` を使ってワークフローのエラーを監視できます。

```typescript {11} filename="src/test-workflow.ts" showLineNumbers copy
import { mastra } from '../src/mastra';

const workflow = mastra.getWorkflow('testWorkflow');

const run = await workflow.createRunAsync();

const stream = await run.stream({
  inputData: {
    value: '初期データ',
  },
});

for await (const chunk of stream.stream) {
  console.log(chunk.payload.output.stats);
}
```

## 関連項目 \{#related\}

* [制御フロー](./control-flow)
* [条件分岐](./control-flow#conditional-logic-with-branch)
* [ワークフローの実行](/docs/examples/workflows/running-workflows)