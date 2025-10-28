---
title: "入力データのマッピング"
description: "Mastra のワークフローで入力マッピングを使って、より動的なデータフローを構築する方法を学びましょう。"
sidebar_position: 6
---

# 入力データのマッピング \{#input-data-mapping\}

入力データのマッピングを使うと、次のステップの入力に渡す値を明示的に指定できます。これらの値は、以下のいずれかから取得できます:

* 前のステップの出力
* 実行時コンテキスト
* 定数
* ワークフローの初期入力

## `.map()` を使ったマッピング \{#mapping-with-map\}

この例では、`step1` の `output` を、`step2` に必要な `inputSchema` に合わせるように変換します。`step1` の値は、`.map` 関数の `inputData` パラメーターから参照できます。

![.map() を使ったマッピング](/img/workflows/workflows-data-mapping-map.jpg)

```typescript {9} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
const step1 = createStep({...});
const step2 = createStep({...});

export const testWorkflow = createWorkflow({...})
  .then(step1)
  .map(async ({ inputData }) => {
    const { value } = inputData;
    return {
      output: `new ${value}`
    };
  })
  .then(step2)
  .commit();
```

## `inputData` の使用 \{#using-inputdata\}

前のステップの出力全体にアクセスするには、`inputData` を使用します:

```typescript {3} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
  .then(step1)
  .map(({ inputData }) => {
    console.log(inputData);
  })
```

## `getStepResult()` の使用 \{#using-getstepresult\}

特定のステップのインスタンスを参照して、そのステップの完全な出力にアクセスするには、`getStepResult()` を使用します。

```typescript {3} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
  .then(step1)
  .map(async ({ getStepResult }) => {
    console.log(getStepResult(step1));
  })
```

## `getInitData()` を使用する \{#using-getinitdata\}

`getInitData` を使って、ワークフローに渡された初期入力データにアクセスします。

```typescript {3} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
  .then(step1)
  .map(async ({ getInitData }) => {
      console.log(getInitData());
  })
```

## `mapVariable()` の使用 \{#using-mapvariable\}

`mapVariable` を使用するには、workflows モジュールから該当の関数をインポートします。

```typescript filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { mapVariable } from '@mastra/core/workflows';
```

### `mapVariable()` を使ったステップ出力のリネーム \{#renaming-step-with-mapvariable\}

`.map()` のオブジェクト構文を使うと、ステップの出力名を変更できます。次の例では、`step1` の `value` 出力が `details` にリネームされています:

```typescript {3-6} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
  .then(step1)
  .map({
    details: mapVariable({
      step: step,
      path: "value"
    })
  })
```

### `mapVariable()` を使ったワークフロー出力のリネーム \{#renaming-workflows-with-mapvariable\}

**参照合成**を使うと、ワークフローの出力をリネームできます。これは、ワークフローのインスタンスを `initData` として渡すことによって行います。

```typescript {6-9} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
export const testWorkflow = createWorkflow({...});

testWorkflow
  .then(step1)
  .map({
    details: mapVariable({
      initData: testWorkflow,
      path: "value"
    })
  })
```
