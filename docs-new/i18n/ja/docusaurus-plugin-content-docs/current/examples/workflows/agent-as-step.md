---
title: "ステップとしてエージェントを使用する"
description: Mastraを使って、ワークフロー内のステップとしてエージェントを統合する例。
---

# ステップとしてのエージェント \{#agent-as-a-step\}

ワークフローには、ステップとしてエージェントを組み込めます。次の例では、`createStep()` を使ってエージェントをステップとして定義する方法を示します。

## エージェントの作成 \{#creating-an-agent\}

都市に関する事実を返すシンプルなエージェントを作成します。

```typescript filename="src/mastra/agents/example-city-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

export const cityAgent = new Agent({
  name: 'city-agent',
  description: '都市に関する情報を生成',
  instructions: '指定された都市に基づいて興味深い事実を返す',
  model: openai('gpt-4o'),
});
```

### エージェントの入出力スキーマ \{#agent-inputoutput-schema\}

Mastra エージェントは、入力に `prompt` 文字列を受け取り、出力に `text` 文字列を返すデフォルトのスキーマを使用します。

```typescript
{
  inputSchema: {
    prompt: string
  },
  outputSchema: {
    text: string
  }
}
```

## ステップとしてのエージェント \{#agent-as-step\}

エージェントをステップとして使用するには、`createStep()` にそのまま渡します。`.map()` メソッドを使って、ワークフローの入力をエージェントが期待する形に変換します。

この例では、ワークフローが `city` を入力として受け取り、それを `prompt` にマッピングしてからエージェントを呼び出します。エージェントは `text` という文字列を返し、それがワークフローの出力にそのまま渡されます。出力スキーマは `facts` というフィールドを想定していますが、追加のマッピングは不要です。

```typescript filename="src/mastra/workflows/example-agent-step.ts" showLineNumbers copy
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { cityAgent } from '../agents/example-city-agent';

const step1 = createStep(cityAgent);

export const agentAsStep = createWorkflow({
  id: 'agent-step-workflow',
  inputSchema: z.object({
    city: z.string(),
  }),
  outputSchema: z.object({
    facts: z.string(),
  }),
})
  .map(async ({ inputData }) => {
    const { city } = inputData;
    return {
      prompt: `${city}に関する興味深い事実を作成してください`,
    };
  })

  .then(step1)
  .commit();
```

## 関連情報 \{#related\}

* [ワークフローの実行](./running-workflows)

## ワークフロー（レガシー） \{#workflows-legacy\}

以下は、レガシー版ワークフロー向けのサンプルドキュメントです。

* [ワークフローからエージェントを呼び出す（レガシー）](/docs/examples/workflows_legacy/calling-agent)
* [ツールをワークフローのステップとして使用する（レガシー）](/docs/examples/workflows_legacy/using-a-tool-as-a-step)