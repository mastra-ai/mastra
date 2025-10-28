---
title: "エージェントとツール"
description: "Mastra のワークフローでは、ステップによって入力・出力・実行ロジックを定義し、作業を体系的に管理できます。"
sidebar_position: 3
---

# エージェントとツール \{#agents-and-tools\}

ワークフローのステップは合成可能で、通常は `execute` 関数内でロジックを直接実行します。ただし、状況によってはエージェントやツールを呼び出す方が適切な場合があります。特に次のようなケースで有用です：

* LLM を用いて、ユーザー入力から自然言語の応答を生成する場合
* 複雑な、または再利用性の高いロジックを専用のツールとして切り出す場合
* サードパーティ API と、構造化された／再利用可能な方法で連携する場合

ワークフローでは、ステップとして Mastra のエージェントやツールをそのまま利用できます。例：`createStep(testAgent)` や `createStep(testTool)`。

## ワークフローでのエージェントの使用 \{#using-agents-in-workflows\}

ワークフローにエージェントを含めるには、通常どおり定義したうえで、`createStep(testAgent)` を使ってワークフローに直接追加するか、ステップの `execute` 関数内から `.generate()` で呼び出します。

### エージェントの例 \{#example-agent\}

このエージェントは、OpenAI を使って都市、国、タイムゾーンに関する豆知識を生成します。

```typescript filename="src/mastra/agents/test-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

export const testAgent = new Agent({
  name: 'test-agent',
  description: '都市に基づいて国の情報を生成する',
  instructions: `指定された都市に基づいて、その国に関する興味深い事実を返してください`,
  model: openai('gpt-4o'),
});
```

### ステップとしてエージェントを追加する \{#adding-an-agent-as-a-step\}

この例では、`step1` は指定された都市に基づいて、その国に関する興味深いトリビアを生成するために `testAgent` を使用します。

`.map` メソッドは、ワークフロー入力を `testAgent` と互換性のある `prompt` 文字列へと変換します。

このステップは `.then()` でワークフローに組み込み、マッピングされた入力を受け取ってエージェントの構造化出力を返します。ワークフローは `.commit()` で確定します。

![ステップとしてのエージェント](/img/workflows/workflows-agent-tools-agent-step.jpg)

```typescript {3} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { testAgent } from '../agents/test-agent';

const step1 = createStep(testAgent);

export const testWorkflow = createWorkflow({
  id: 'test-workflow',
  description: 'テストワークフロー',
  inputSchema: z.object({
    input: z.string(),
  }),
  outputSchema: z.object({
    output: z.string(),
  }),
})
  .map(({ inputData }) => {
    const { input } = inputData;
    return {
      prompt: `次の都市に関する情報を提供してください: ${input}`,
    };
  })
  .then(step1)
  .commit();
```

### `.generate()` を使ってエージェントを呼び出す \{#calling-an-agent-with-generate\}

この例では、`step1` が与えられた `input` からプロンプトを組み立てて `testAgent` に渡し、`testAgent` はその都市とその国に関する事実を含むプレーンテキストの応答を返します。

このステップは逐次的な `.then()` メソッドでワークフローに追加され、ワークフローからの入力を受け取り、構造化された出力を返せるようになります。ワークフローは `.commit()` で確定します。

```typescript {1,18, 29} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { testAgent } from "../agents/test-agent";

const step1 = createStep({
  id: "step-1",
  description: "都市から国に関する事実情報を作成する",
  inputSchema: z.object({
    input: z.string()
  }),
  outputSchema: z.object({
    output: z.string()
  }),

  execute: async ({ inputData }) => {
    const { input } = inputData;

    const  prompt = `その都市に関する事実を挙げてください: ${input}`

    const { text } = await testAgent.generate([
      { role: "user", content: prompt }
    ]);

    return {
      output: text
    };
  }
});

export const testWorkflow = createWorkflow({...})
  .then(step1)
  .commit();
```

## ワークフローでのツールの使用 \{#using-tools-in-workflows\}

ワークフロー内でツールを使用するには、通常どおりに定義したうえで、`createStep(testTool)` を使ってワークフローに直接追加するか、ステップの `execute` 関数内で `.execute()` を使って呼び出します。

### 例のツール \{#example-tool\}

以下の例では、Open-Meteo API を使って都市の位置情報を取得し、都市名、国名、タイムゾーンを返します。

```typescript filename="src/mastra/tools/test-tool.ts" showLineNumbers copy
import { createTool } from '@mastra/core';
import { z } from 'zod';

export const testTool = createTool({
  id: 'test-tool',
  description: '都市の国名を取得します',
  inputSchema: z.object({
    input: z.string(),
  }),
  outputSchema: z.object({
    country_name: z.string(),
  }),
  execute: async ({ context }) => {
    const { input } = context;
    const geocodingResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${input}`);
    const geocodingData = await geocodingResponse.json();

    const { country } = geocodingData.results[0];

    return {
      country_name: country,
    };
  },
});
```

### ステップとしてツールを追加する \{#adding-a-tool-as-a-step\}

この例では、`step1` は `testTool` を使用します。これは、指定された `city` を使ってジオコーディング検索を行い、解決された `country` を返します。

このステップは逐次的な `.then()` メソッドでワークフローに追加され、ワークフローからの入力を受け取り、構造化された出力を返せます。ワークフローは `.commit()` で確定されます。

![ステップとしてのツール](/img/workflows/workflows-agent-tools-tool-step.jpg)

```typescript {1,3,6} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { testTool } from "../tools/test-tool";

const step1 = createStep(testTool);

export const testWorkflow = createWorkflow({...})
  .then(step1)
  .commit();
```

### `.execute()` を使ってツールを呼び出す \{#calling-a-tool-with-execute\}

この例では、`step1` が `.execute()` メソッドで `testTool` を直接呼び出します。ツールは指定された `city` を使ってジオコーディング検索を行い、対応する `country` を返します。

結果はステップの構造化出力として返されます。ステップは `.then()` でワークフローに組み込まれ、ワークフローの入力を処理して型付きの出力を生成します。ワークフローは `.commit()` で確定されます。

```typescript {3,20,32} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { RuntimeContext } from "@mastra/core/di";

import { testTool } from "../tools/test-tool";

const runtimeContext = new RuntimeContext();

const step1 = createStep({
  id: "step-1",
  description: "都市が属する国を取得します",
  inputSchema: z.object({
    input: z.string()
  }),
  outputSchema: z.object({
    output: z.string()
  }),

  execute: async ({ inputData }) => {
    const { input } = inputData;

    const { country_name } = await testTool.execute({
      context: { input },
      runtimeContext
    });

    return {
      output: country_name
    };
  }
});

export const testWorkflow = createWorkflow({...})
  .then(step1)
  .commit();
```

## ツールとしてワークフローを使う \{#using-workflows-as-tools\}

この例では、`cityStringWorkflow` ワークフローがメインの Mastra インスタンスに追加されています。

```typescript {7} filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from "@mastra/core/mastra";

import { testWorkflow, cityStringWorkflow } from "./workflows/test-workflow";

export const mastra = new Mastra({
  ...
  workflows: { testWorkflow, cityStringWorkflow },
});
```

ワークフローを登録すると、ツール内から `getWorkflow` で参照できます。

```typescript {10,17-27} filename="src/mastra/tools/test-tool.ts" showLineNumbers copy
export const cityCoordinatesTool = createTool({
  id: 'city-tool',
  description: '都市の詳細を変換する'
  inputSchema: z.object({
    city: z.string(),
  }),
  outputSchema: z.object({
    outcome: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    const { city } = context;
    const geocodingResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}`);
    const geocodingData = await geocodingResponse.json();

    const { name, country, timezone } = geocodingData.results[0];

    const workflow = mastra?.getWorkflow('cityStringWorkflow');

    const run = await workflow?.createRunAsync();

    const { result } = await run?.start({
      inputData: {
        city_name: name,
        country_name: country,
        country_timezone: timezone,
      },
    });

    return {
      outcome: result.outcome,
    };
  },
});
```

## エージェントでのワークフローの利用 \{#using-workflows-in-agents\}

エージェントでも Workflows を利用できます。このエージェントは、test ツールを使うか test ワークフローを使うかを選択できます。

```typescript
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { testTool } from '../tools/test-tool';
import { testWorkflow } from '../workflows/test-workflow';

export const testAgent = new Agent({
  name: 'test-agent',
  description: '指定された都市に基づいて、その国に関する事実を生成します',
  instructions: `指定された都市に基づいて、その国に関する興味深い豆知識を返してください`,
  model: openai('gpt-4o'),
  workflows: {
    test_workflow: testWorkflow,
  },
  tools: {
    test_tool: testTool,
  },
});
```

## `MCPServer` を使ってワークフローを公開する \{#exposing-workflows-with-mcpserver\}

Mastra の `MCPServer` インスタンスにワークフローを渡すことで、ワークフローをツールに変換できます。これにより、MCP 互換の任意のクライアントがワークフローにアクセスできるようになります。

ワークフローの説明はツールの説明となり、入力スキーマはツールの入力スキーマになります。

サーバーにワークフローを渡すと、各ワークフローは自動的に呼び出し可能なツールとして公開されます。例えば次のとおりです:

* `run_testWorkflow`。

```typescript filename="src/test-mcp-server.ts" showLineNumbers copy
import { MCPServer } from '@mastra/mcp';

import { testAgent } from './mastra/agents/test-agent';
import { testTool } from './mastra/tools/test-tool';
import { testWorkflow } from './mastra/workflows/test-workflow';

async function startServer() {
  const server = new MCPServer({
    name: 'test-mcp-server',
    version: '1.0.0',
    workflows: {
      testWorkflow,
    },
  });

  await server.startStdio();
  console.log('標準入出力でMCPServerが起動しました')
}

startServer().catch(console.error);
```

サーバーでワークフローが利用可能か確認するには、MCPClient に接続します。

```typescript filename="src/test-mcp-client.ts" showLineNumbers copy
import { MCPClient } from '@mastra/mcp';

async function main() {
  const mcp = new MCPClient({
    servers: {
      local: {
        command: 'npx',
        args: ['tsx', 'src/test-mcp-server.ts'],
      },
    },
  });

  const tools = await mcp.getTools();
  console.log(tools);
}

main().catch(console.error);
```

クライアントスクリプトを実行して、ワークフローツールを表示します。

```bash
npx tsx src/test-mcp-client.ts
```

## さらに詳しく \{#more-resources\}

* [MCPServer リファレンス ドキュメント](/docs/reference/tools/mcp-server)
* [MCPClient リファレンス ドキュメント](/docs/reference/tools/mcp-client)