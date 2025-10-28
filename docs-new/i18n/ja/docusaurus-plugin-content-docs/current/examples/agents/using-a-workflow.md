---
title: "エージェントにワークフローを追加する"
description: Mastra で、サッカーの試合日程情報を提供するために、専用ワークフローを用いる AI エージェントを作成する例。
---

# ワークフローを追加する \{#adding-a-workflow\}

AI エージェントを構築する際には、複数ステップのタスクを実行したり、構造化データを取得したりするワークフローと組み合わせると便利です。Mastra では、`workflows` パラメータを使ってエージェントにワークフローを渡せます。ワークフローは、エージェントがあらかじめ定義された一連の手順を起動できる仕組みを提供し、単一のツールでは対応できない、より複雑な処理にアクセスできるようにします。

## 前提条件 \{#prerequisites\}

この例では `openai` モデルを使用します。`OPENAI_API_KEY` を `.env` ファイルに必ず追加してください。

```bash filename=".env" copy
OPENAI_API_KEY=<your-api-key>
```

## ワークフローの作成 \{#creating-a-workflow\}

このワークフローは、指定した日付のイングランド・プレミアリーグの試合日程を取得します。入力・出力スキーマを明確に定義することで、データの一貫性が保たれ、エージェントが扱いやすくなります。

```typescript filename="src/mastra/workflows/example-soccer-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

const getFixtures = createStep({
  id: 'get-fixtures',
  description: 'イングランドプレミアリーグの試合日程を取得',
  inputSchema: z.object({
    date: z.string(),
  }),
  outputSchema: z.object({
    fixtures: z.any(),
  }),
  execute: async ({ inputData }) => {
    const { date } = inputData;

    const response = await fetch(
      `https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d=${date}&l=English_Premier_League`,
    );
    const { events } = await response.json();

    return {
      fixtures: events,
    };
  },
});

export const soccerWorkflow = createWorkflow({
  id: 'soccer-workflow',
  inputSchema: z.object({
    date: z.string(),
  }),
  outputSchema: z.object({
    fixtures: z.any(),
  }),
})
  .then(getFixtures)
  .commit();
```

## エージェントにワークフローを追加する \{#adding-a-workflow-to-an-agent\}

このエージェントは、`soccerWorkflow` を使って試合日程に関する質問に回答します。指示では、日付を算出し、それを `YYYY-MM-DD` 形式で渡し、チーム名、試合開始時刻、日付を返すよう求めています。

```typescript filename="src/mastra/agents/example-soccer-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

import { soccerWorkflow } from '../workflows/example-soccer-workflow';

export const soccerAgent = new Agent({
  name: 'soccer-agent',
  description: 'プレミアリーグサッカーの専門家',
  instructions: `あなたはプレミアリーグサッカーの専門家です。soccerWorkflowを使用して試合データを取得してください。

  ${new Date()}を基準に日付を計算し、YYYY-MM-DD形式でワークフローに渡してください。

  チーム名、試合時間、日付のみを表示してください。`,
  model: openai('gpt-4o'),
  workflows: { soccerWorkflow },
});
```

## 使用例 \{#example-usage\}

`getAgent()` でエージェントへの参照を取得し、プロンプトを渡して `generate()` を呼び出します。

```typescript filename="src/test-soccer-agent.ts" showLineNumbers copy
import 'dotenv/config';

import { mastra } from './mastra';

const agent = mastra.getAgent('soccerAgent');

const response = await agent.generate('今週末はどの試合が行われますか?');

console.log(response.text);
```
