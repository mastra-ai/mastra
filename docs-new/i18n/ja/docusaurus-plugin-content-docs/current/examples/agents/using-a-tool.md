---
title: "エージェントにツールを追加する"
description: Mastra で天気情報を提供する専用ツールを使う AI エージェントを作成する例。
---

# ツールの追加 \{#adding-a-tool\}

AI エージェントを構築する際には、外部のデータや機能で能力を拡張する必要がしばしばあります。Mastra では、`tools` パラメータを使ってエージェントにツールを渡せます。ツールは、データの取得や計算の実行などの特定の関数を呼び出す手段をエージェントに与え、ユーザーの質問に答えるのを支援します。

## 前提条件 \{#prerequisites\}

この例では `openai` モデルを使用します。`OPENAI_API_KEY` を `.env` ファイルに追加してください。

```bash filename=".env" copy
OPENAI_API_KEY=<your-api-key>
```

## ツールの作成 \{#creating-a-tool\}

このツールはロンドンの過去の気象データを提供し、当年の1月1日から本日までの日ごとの気温、降水量、風速、降雪量、天候の配列を返します。この構造により、エージェントは直近の天候トレンドに容易にアクセスして把握できます。

```typescript filename="src/mastra/tools/example-london-weather-tool.ts" showLineNumbers copy
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const londonWeatherTool = createTool({
  id: 'london-weather-tool',
  description: 'ロンドンの年初来の気象データを返します',
  outputSchema: z.object({
    date: z.array(z.string()),
    temp_max: z.array(z.number()),
    temp_min: z.array(z.number()),
    rainfall: z.array(z.number()),
    windspeed: z.array(z.number()),
    snowfall: z.array(z.number()),
  }),
  execute: async () => {
    const startDate = `${new Date().getFullYear()}-01-01`;
    const endDate = new Date().toISOString().split('T')[0];

    const response = await fetch(
      `https://archive-api.open-meteo.com/v1/archive?latitude=51.5072&longitude=-0.1276&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,snowfall_sum&timezone=auto`,
    );

    const { daily } = await response.json();

    return {
      date: daily.time,
      temp_max: daily.temperature_2m_max,
      temp_min: daily.temperature_2m_min,
      rainfall: daily.precipitation_sum,
      windspeed: daily.windspeed_10m_max,
      snowfall: daily.snowfall_sum,
    };
  },
});
```

## エージェントにツールを追加する \{#adding-a-tool-to-an-agent\}

このエージェントは、`londonWeatherTool` を使ってロンドンの過去の天候に関する質問に回答します。すべての問い合わせでこのツールを使い、回答は「現在の暦年」で利用可能なデータに限定するように促す、明確な指示が与えられています。

```typescript filename="src/mastra/agents/example-london-weather-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

import { londonWeatherTool } from '../tools/example-london-weather-tool';

export const londonWeatherAgent = new Agent({
  name: 'london-weather-agent',
  description: 'ロンドンの気象に関する過去のデータを提供します',
  instructions: `あなたはロンドンの過去の気象データにアクセスできる親切なアシスタントです。
    - データは今年の1月1日から本日までに限定されています。
    - 提供されたツール(londonWeatherTool)を使用して関連データを取得してください。
    - そのデータを使用してユーザーの質問に回答してください。
    - 回答は簡潔で事実に基づいた有益なものにしてください。
    - 利用可能なデータで質問に回答できない場合は、明確にその旨を伝えてください。`,
  model: openai('gpt-4o'),
  tools: { londonWeatherTool },
});
```

## 使用例 \{#example-usage\}

`getAgent()` でエージェントの参照を取得し、`generate()` をプロンプトとともに呼び出します。

```typescript filename="src/test-london-weather-agent.ts" showLineNumbers copy
import 'dotenv/config';

import { mastra } from './mastra';

const agent = mastra.getAgent('londonWeatherAgent');

const response = await agent.generate('今年は何回雨が降りましたか?');

console.log(response.text);
```

<GithubLink outdated={true} marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/agents/using-a-tool" />

## 関連項目 \{#related\}

* [エージェントの呼び出し](./calling-agents#from-the-command-line)