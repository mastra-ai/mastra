---
title: "制御フロー"
description: "Mastra のワークフローにおける制御フローでは、分岐・マージ・条件を管理して、要件に合ったロジックのワークフローを構築できます。"
sidebar_position: 2
---

# 制御フロー \{#control-flow\}

ワークフローを構築する際は、通常、処理をより小さなタスクに分割し、それらを連携させて再利用できるようにします。**ステップ**は、入力・出力・実行ロジックを定義することで、これらのタスクを体系的に管理する方法を提供します。

* スキーマが一致する場合、各ステップの `outputSchema` は自動的に次のステップの `inputSchema` に渡されます。
* スキーマが一致しない場合は、[Input data mapping](./input-data-mapping) を使用して、`outputSchema` を期待される `inputSchema` に変換します。

## `.then()` を使ったステップのチェーン \{#chaining-steps-with-then\}

`.then()` を使ってステップを連結し、順番に実行します:

![.then() を使ったステップのチェーン](/img/workflows/workflows-control-flow-then.jpg)

```typescript {8-9,4-5} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({...});
const step2 = createStep({...});

export const testWorkflow = createWorkflow({...})
  .then(step1)
  .then(step2)
  .commit();
```

期待どおりに動作します。まず `step1` を実行し、続いて `step2` を実行します。

## `.parallel()` を使った並行ステップ \{#simultaneous-steps-with-parallel\}

`.parallel()` を使ってステップを並行実行します:

![.parallel() を使った並行ステップ](/img/workflows/workflows-control-flow-parallel.jpg)

```typescript {9,4-5} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({...});
const step2 = createStep({...});
const step3 = createStep({...});

export const testWorkflow = createWorkflow({...})
  .parallel([step1, step2])
  .then(step3)
  .commit();
```

これは `step1` と `step2` を並行して実行し、両方の完了後に `step3` に進みます。

> 詳細は [Parallel Execution with Steps](/docs/examples/workflows/parallel-steps) を参照してください。

> 📹 視聴: ステップを並行実行して Mastra のワークフローを最適化する方法 → [YouTube（3分）](https://youtu.be/GQJxve5Hki4)

## `.branch()` を使った条件分岐 \{#conditional-logic-with-branch\}

`.branch()` を使って、条件に応じてステップを実行します:

![.branch() による条件分岐](/img/workflows/workflows-control-flow-branch.jpg)

```typescript {8-11,4-5} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const lessThanStep = createStep({...});
const greaterThanStep = createStep({...});

export const testWorkflow = createWorkflow({...})
  .branch([
    [async ({ inputData: { value } }) => value <= 10, lessThanStep],
    [async ({ inputData: { value } }) => value > 10, greaterThanStep]
  ])
  .commit();
```

ブランチ条件は順番に評価されますが、条件に一致したステップは並列で実行されます。

> 詳細は [Workflow with Conditional Branching](/docs/examples/workflows/conditional-branching) を参照してください。

## ループ処理ステップ \{#looping-steps\}

Workflows は 2 種類のループをサポートします。ステップ（ネストされたワークフローなど、ステップ互換の構成要素を含む）をループする場合、初期の `inputData` は前のステップの出力が元になります。

互換性を確保するため、ループの初期入力は前のステップの出力の構造に一致しているか、`map` 関数を使って明示的に変換されている必要があります。

* 前のステップの出力の構造に一致させる、または
* `map` 関数を使用して明示的に変換する。

### `.dowhile()` による繰り返し \{#repeating-with-dowhile\}

条件が true の間、ステップを繰り返し実行します。

![.dowhile() による繰り返し](/img/workflows/workflows-control-flow-dowhile.jpg)

```typescript {7} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const counterStep = createStep({...});

export const testWorkflow = createWorkflow({...})
  .dowhile(counterStep, async ({ inputData: { number } }) => number < 10)
  .commit();
```

### `.dountil()` での繰り返し \{#repeating-with-dountil\}

条件が真になるまでステップを繰り返し実行します。

![.dountil() での繰り返し](/img/workflows/workflows-control-flow-dountil.jpg)

```typescript {7} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const counterStep = createStep({...});

export const testWorkflow = createWorkflow({...})
  .doUntil(counterStep, async ({ inputData: { number } }) => number > 10)
  .commit();
```

### ループ管理 \{#loop-management\}

ループの終了方法に応じて、ループ条件はさまざまな実装が可能です。一般的なパターンとしては、`inputData` で返される値の確認、反復回数の上限設定、または上限到達時に実行を中断する方法などがあります。

#### 条件付きループ \{#conditional-loops\}

ループステップの `inputData` は前のステップの出力です。`inputData` の値を用いて、ループを継続するか停止するかを判断します。

```typescript {7} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const counterStep = createStep({...});

export const testWorkflow = createWorkflow({...})
.dountil(nestedWorkflowStep, async ({ inputData: { userResponse } }) => userResponse === "yes")
.commit();
```

#### ループの制限 \{#limiting-loops\}

`iterationCount` は、ループステップが何回実行されたかを追跡します。これを使って反復回数を制限し、無限ループを防止できます。`inputData` の値と組み合わせて、指定した回数に達したらループを停止します。

```typescript {7} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const counterStep = createStep({...});

export const testWorkflow = createWorkflow({...})
.dountil(nestedWorkflowStep, async ({ inputData: { userResponse, iterationCount } }) => userResponse === "yes" || iterationCount >= 10)
.commit();
```

#### ループの中断 \{#aborting-loops\}

`iterationCount` を使ってループの実行回数を制限します。回数がしきい値を超えた場合は、エラーをスローしてステップを失敗させ、ワークフローを停止します。

```typescript {7} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const counterStep = createStep({...});

export const testWorkflow = createWorkflow({...})
.dountil(nestedWorkflowStep, async ({ inputData: { userResponse, iterationCount } }) => {
  if (iterationCount >= 10) {
    throw new Error("最大反復回数に達しました");
  }
  return userResponse === "yes";
})
.commit();
```

### `.foreach()` による繰り返し \{#repeating-with-foreach\}

`inputSchema` の各アイテムに対して、同じステップを順番に実行します。

![.foreach() による繰り返し](/img/workflows/workflows-control-flow-foreach.jpg)

```typescript {7} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const mapStep = createStep({...});

export const testWorkflow = createWorkflow({...})
  .foreach(mapStep)
  .commit();
```

#### 同時実行数の制限を設定する \{#setting-concurrency-limits\}

`concurrency` を使うと、同時に実行できる数に上限を設けつつ、ステップを並列に実行できます。

```typescript {7} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const mapStep = createStep({...})

export const testWorkflow = createWorkflow({...})
  .foreach(mapStep, { concurrency: 2 })
  .commit();
```

## ネストされたワークフローの使用 \{#using-a-nested-workflow\}

`.then()` に渡して、ステップとしてネストされたワークフローを使用します。これにより、親ワークフローの一部として、その各ステップが順に実行されます。

```typescript {4,7} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

export const nestedWorkflow = createWorkflow({...})

export const testWorkflow = createWorkflow({...})
  .then(nestedWorkflow)
  .commit();
```

## ワークフローを複製する \{#cloning-a-workflow\}

既存のワークフローを複製するには、`cloneWorkflow` を使用します。これにより、`id` などのパラメータを変更しつつ、同じ構造を再利用できます。

```typescript {6,10} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep, cloneWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({...});
const parentWorkflow = createWorkflow({...})
const clonedWorkflow = cloneWorkflow(parentWorkflow, { id: "cloned-workflow" });

export const testWorkflow = createWorkflow({...})
  .then(step1)
  .then(clonedWorkflow)
  .commit();
```

## 実行インスタンスの例 \{#example-run-instance\}

次の例では、複数の入力でランを開始する方法を示します。各入力は `mapStep` を順番に通過します。

```typescript {6} filename="src/test-workflow.ts" showLineNumbers copy
import { mastra } from './mastra';

const run = await mastra.getWorkflow('testWorkflow').createRunAsync();

const result = await run.start({
  inputData: [{ number: 10 }, { number: 100 }, { number: 200 }],
});
```

これを実行するには、ターミナルで次を実行してください：

```bash copy
npx tsx src/test-workflow.ts
```
