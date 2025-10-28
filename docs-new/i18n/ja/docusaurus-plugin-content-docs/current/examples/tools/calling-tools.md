---
title: "ツールの呼び出し"
description: ツール対応エージェントの使い方例
---

# ツールの呼び出し \{#calling-tools\}

Mastra で作成したツールとやり取りする方法はいくつかあります。以下では、ワークフローのステップ、エージェント、そしてコマンドラインを使ってツールを呼び出す例を紹介します。ローカルでの素早いテストにも便利です。

## ワークフローのステップから \{#from-a-workflow-step\}

ツールをインポートし、必要な `context` と `runtimeContext` パラメータを渡して `execute()` を呼び出します。`runtimeContext` はステップの `execute` 関数の引数として利用できます。

```typescript filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { testTool } from '../tools/test-tool';

const step1 = createStep({
  // ...
  execute: async ({ inputData, runtimeContext }) => {
    const { value } = inputData;

    const response = await testTool.execute({
      context: {
        value,
      },
      runtimeContext,
    });
  },
});

export const testWorkflow = createWorkflow({
  // ...
})
  .then(step1)
  .commit();
```

## エージェントから \{#from-an-agent\}

ツールは設定時にエージェントに登録されます。エージェントはユーザーのリクエストに応じてこれらのツールを自動で呼び出すことも、エージェントの tools プロパティ経由で直接アクセスすることもできます。ツールは必要なコンテキストおよびランタイムコンテキストとともに実行されます。

```typescript filename="src/mastra/agents/test-agent.ts" showLineNumbers copy
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

import { testTool } from '../tools/test-tool';

export const testAgent = new Agent({
  // 省略
  tools: {
    testTool,
  },
});
```

## コマンドラインから \{#from-the-command-line\}

ローカルでツールをテストするための簡単なスクリプトを作成できます。ツールを直接インポートし、ランタイムコンテキストを作成します。ツールの動作をテストするために、必要な `context` と `runtimeContext` を指定して `execute()` を呼び出します。

```typescript filename="src/test-tool.ts" showLineNumbers copy
import { RuntimeContext } from '@mastra/core/runtime-context';
import { testTool } from '../src/mastra/tools/test-tool';

const runtimeContext = new RuntimeContext();

const result = await testTool.execute({
  context: {
    value: 'foo',
  },
  runtimeContext,
});

console.log(result);
```

次のコマンドで、コマンドラインからこのスクリプトを実行します:

```bash
npx tsx src/test-tool.ts を実行
```
