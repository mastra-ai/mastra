---
title: "入力としての配列（.foreach()）"
description: ワークフローで .foreach() を使用して配列を処理する Mastra の例。
---

# 配列を入力として使う \{#array-as-input\}

一部のワークフローでは、配列の各要素に同じ処理を行う必要があります。この例では、`.foreach()` を使用して文字列のリストを走査し、各要素に同じステップを適用して、変換後の配列を出力として生成する方法を示します。

## `.foreach()` を使った繰り返し \{#repeating-with-foreach\}

この例では、ワークフローは `.foreach()` を使用して、入力配列内の各文字列に `mapStep` ステップを適用します。各項目について、元の値に文字列 `" mapStep"` を付加します。すべての項目の処理が完了すると、`step2` が実行され、更新された配列が出力に渡されます。

```typescript filename="src/mastra/workflows/example-looping-foreach.ts" showLineNumbers copy
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

const mapStep = createStep({
  id: 'map-step',
  description: '入力値にmapStepサフィックスを追加',
  inputSchema: z.string(),
  outputSchema: z.object({
    value: z.string(),
  }),
  execute: async ({ inputData }) => {
    return {
      value: `${inputData} mapStep`,
    };
  },
});

const step2 = createStep({
  id: 'step-2',
  description: '入力から出力に値を渡す',
  inputSchema: z.array(
    z.object({
      value: z.string(),
    }),
  ),
  outputSchema: z.array(
    z.object({
      value: z.string(),
    }),
  ),
  execute: async ({ inputData }) => {
    return inputData.map(({ value }) => ({
      value: value,
    }));
  },
});

export const loopingForeach = createWorkflow({
  id: 'foreach-workflow',
  inputSchema: z.array(z.string()),
  outputSchema: z.array(
    z.object({
      value: z.string(),
    }),
  ),
})
  .foreach(mapStep)
  .then(step2)
  .commit();
```

> 複数の文字列を入力してこの例を実行します。

## 関連項目 \{#related\}

* [ワークフローの実行](./running-workflows)

## ワークフロー（レガシー） \{#workflows-legacy\}

以下のリンクでは、レガシー版ワークフローのドキュメント例を紹介します。

* [シンプルなワークフローの作成（レガシー）](/docs/examples/workflows_legacy/creating-a-workflow)
* [ワークフロー変数を用いたデータマッピング（レガシー）](/docs/examples/workflows_legacy/workflow-variables)