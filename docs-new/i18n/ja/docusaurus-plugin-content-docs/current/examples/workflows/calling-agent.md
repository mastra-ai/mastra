---
title: "ワークフローからエージェントを呼び出す"
description: ワークフローのステップ内でMastraを使ってAIエージェントを呼び出す例。
---

# ステップ内でエージェントを呼び出す \{#calling-an-agent-inside-a-step\}

ワークフローは、ステップ内からエージェントを呼び出して動的な応答を生成できます。次の例では、エージェントの定義方法、Mastra インスタンスへの登録方法、そしてワークフローのステップ内で `.generate()` を用いて呼び出す方法を示します。ワークフローは都市名を入力として受け取り、その都市に関する事実を返します。

## エージェントの作成 \{#creating-an-agent\}

都市に関する情報を返すシンプルなエージェントを作成します。

```typescript filename="src/mastra/agents/example-city-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

export const cityAgent = new Agent({
  name: 'city-agent',
  description: '都市に関する情報を生成',
  instructions: `指定された都市に関する興味深い事実を返してください`,
  model: openai('gpt-4o'),
});
```

## エージェントの登録 \{#registering-an-agent\}

ワークフローからエージェントを呼び出すには、Mastra インスタンスにエージェントを登録しておく必要があります。

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { cityAgent } from './agents/example-city-agent';

export const mastra = new Mastra({
  // ...
  agents: { cityAgent },
});
```

## エージェントの呼び出し \{#calling-an-agent\}

`getAgent()` で登録済みエージェントの参照を取得し、ステップ内で `.generate()` を呼び出して入力データを渡します。

```typescript filename="src/mastra/workflows/example-call-agent.ts" showLineNumbers copy
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

const step1 = createStep({
  id: 'step-1',
  description: '入力からエージェントに値を渡します',
  inputSchema: z.object({
    city: z.string(),
  }),
  outputSchema: z.object({
    facts: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const { city } = inputData;

    const agent = mastra.getAgent('cityAgent');
    const response = await agent.generate(`${city}に関する興味深い事実を作成してください`);

    return {
      facts: response.text,
    };
  },
});

export const callAgent = createWorkflow({
  id: 'agent-workflow',
  inputSchema: z.object({
    city: z.string(),
  }),
  outputSchema: z.object({
    facts: z.string(),
  }),
})
  .then(step1)
  .commit();
```

## 関連項目 \{#related\}

* [ワークフローの実行](./running-workflows)