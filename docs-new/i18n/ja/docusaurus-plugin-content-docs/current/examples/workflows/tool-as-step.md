---
title: "ステップとしてツールを使用する"
description: ワークフローのステップとしてツールを統合するために Mastra を使う例。
---

# ステップとしてのツール \{#tool-as-a-step\}

ワークフローには、ステップとしてツールを組み込むことができます。次の例では、`createStep()` を使用してツールをステップとして定義する方法を示します。

## ツールの作成 \{#creating-a-tool\}

文字列を入力として受け取り、逆順にした結果を返すシンプルなツールを作成します。

```typescript filename="src/mastra/tools/example-reverse-tool.ts" showLineNumbers copy
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const reverseTool = createTool({
  id: 'reverse-tool',
  description: '入力文字列を逆順にします',
  inputSchema: z.object({
    input: z.string(),
  }),
  outputSchema: z.object({
    output: z.string(),
  }),
  execute: async ({ context }) => {
    const { input } = context;
    const reversed = input.split('').reverse().join('');

    return {
      output: reversed,
    };
  },
});
```

## ステップとしてのツール \{#tool-as-step\}

`createStep()` にツールを直接渡してステップとして使用します。`.map()` の使用は任意です。ツールはそれぞれ独自の入力・出力スキーマを定義しているため必須ではありませんが、ワークフローの `inputSchema` がツールの `inputSchema` と一致しない場合には有用です。

この例では、ワークフローは `word` を受け取り、それをツールの `input` にマッピングします。ツールは `output` という文字列を返し、それが追加の変換なしにワークフローの `reversed` 出力へそのまま渡されます。

```typescript filename="src/mastra/workflows/example-tool-step.ts" showLineNumbers copy
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { reverseTool } from '../tools/example-reverse-tool';

const step1 = createStep(reverseTool);

export const toolAsStep = createWorkflow({
  id: 'tool-step-workflow',
  inputSchema: z.object({
    word: z.string(),
  }),
  outputSchema: z.object({
    reversed: z.string(),
  }),
})
  .map(async ({ inputData }) => {
    const { word } = inputData;

    return {
      input: word,
    };
  })
  .then(step1)
  .commit();
```

## 関連項目 \{#related\}

* [ワークフローの実行](./running-workflows)

## ワークフロー（レガシー） \{#workflows-legacy\}

以下のリンクでは、レガシー版ワークフローのサンプルドキュメントを参照できます：

* [ワークフローからエージェントを呼び出す（レガシー）](/docs/examples/workflows_legacy/calling-agent)
* [ツールをワークフローのステップとして使用する（レガシー）](/docs/examples/workflows_legacy/using-a-tool-as-a-step)