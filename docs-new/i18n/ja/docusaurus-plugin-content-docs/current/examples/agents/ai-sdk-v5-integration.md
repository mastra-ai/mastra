---
title: "AI SDK v5 の統合"
description: メモリとツール統合に対応したストリーミングチャットインターフェースにおける、Mastra エージェントと AI SDK v5 の統合例。
---

# 例: AI SDK v5 との統合 \{#example-ai-sdk-v5-integration\}

この例では、Mastra エージェントを [AI SDK v5](https://sdk.vercel.ai/) と連携し、最新のストリーミング対応チャットインターフェースを構築する方法を紹介します。リアルタイムの会話機能、永続メモリ、そして AI SDK v5 のフォーマットに対応した `stream` メソッドによるツール連携を備えた、完全な Next.js アプリケーションの例を示します。

## 主要機能 \{#key-features\}

* **ストリーミングチャットインターフェース**: AI SDK v5 の `useChat` フックでリアルタイムな対話を実現
* **Mastra エージェント統合**: 独自ツールと OpenAI GPT-4o を活用した天気エージェント
* **永続的メモリ**: 会話履歴を LibSQL に保存
* **互換レイヤー**: Mastra と AI SDK v5 のストリームをシームレスに連携
* **ツール連携**: リアルタイムのデータ取得に対応するカスタム天気ツール

## Mastra の設定 \{#mastra-configuration\}

まず、Mastra エージェントにメモリとツールを設定します：

```typescript showLineNumbers copy filename="src/mastra/index.ts"
import { ConsoleLogger } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';
import { weatherAgent } from './agents';

export const mastra = new Mastra({
  agents: { weatherAgent },
  logger: new ConsoleLogger(),
  // aiSdkCompat: "v4", // オプション: 互換性を追加する場合
});
```

```typescript showLineNumbers copy filename="src/mastra/agents/index.ts"
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { weatherTool } from '../tools';

export const memory = new Memory({
  storage: new LibSQLStore({
    url: `file:./mastra.db`,
  }),
  options: {
    semanticRecall: false,
    workingMemory: {
      enabled: false,
    },
    lastMessages: 5,
  },
});

export const weatherAgent = new Agent({
  name: '天気エージェント',
  instructions: `
    あなたは正確な天気情報を提供する親切な天気アシスタントです。

    あなたの主な役割は、ユーザーが特定の場所の天気情報を取得できるよう支援することです。応答する際は:
    - 場所が指定されていない場合は必ず場所を尋ねてください
    - 湿度、風の状況、降水量などの関連情報を含めてください
    - 簡潔かつ有益な応答を心がけてください

    現在の天気データを取得するにはweatherToolを使用してください。
  `,
  model: openai('gpt-4o-mini'),
  tools: {
    weatherTool,
  },
  memory,
});
```

## カスタム天気ツール \{#custom-weather-tool\}

リアルタイムの気象データを取得するツールを作成します：

```typescript showLineNumbers copy filename="src/mastra/tools/index.ts"
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const weatherTool = createTool({
  id: 'get-weather',
  description: '指定された場所の現在の天気を取得',
  inputSchema: z.object({
    location: z.string().describe('都市名'),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    feelsLike: z.number(),
    humidity: z.number(),
    windSpeed: z.number(),
    windGust: z.number(),
    conditions: z.string(),
    location: z.string(),
  }),
  execute: async ({ context }) => {
    return await getWeather(context.location);
  },
});

const getWeather = async (location: string) => {
  // ジオコーディングAPI呼び出し
  const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`;
  const geocodingResponse = await fetch(geocodingUrl);
  const geocodingData = await geocodingResponse.json();

  if (!geocodingData.results?.[0]) {
    throw new Error(`場所「${location}」が見つかりません`);
  }

  const { latitude, longitude, name } = geocodingData.results[0];

  // 天気API呼び出し
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,weather_code`;
  const response = await fetch(weatherUrl);
  const data = await response.json();

  return {
    temperature: data.current.temperature_2m,
    feelsLike: data.current.apparent_temperature,
    humidity: data.current.relative_humidity_2m,
    windSpeed: data.current.wind_speed_10m,
    windGust: data.current.wind_gusts_10m,
    conditions: getWeatherCondition(data.current.weather_code),
    location: name,
  };
};
```

## Next.js の API ルート \{#nextjs-api-routes\}

### ストリーミングチャットエンドポイント \{#streaming-chat-endpoint\}

AI SDK v5 の形式で `stream` メソッドを使用し、Mastra エージェントからの応答をストリーミングする API ルートを作成します。

```typescript showLineNumbers copy filename="app/api/chat/route.ts"
import { mastra } from './mastra';

const myAgent = mastra.getAgent('weatherAgent');

export async function POST(req: Request) {
  const { messages } = await req.json();

  // AI SDK v5形式でstreamを使用（実験的機能）
  const stream = await myAgent.stream(messages, {
    format: 'aisdk', // AI SDK v5互換性を有効化
    memory: {
      thread: 'user-session', // 実際のユーザー/セッションIDを使用
      resource: 'weather-chat',
    },
  });

  // ストリームは既にAI SDK v5形式
  return stream.toUIMessageStreamResponse();
}
```

### チャットの初期履歴 \{#initial-chat-history\}

Mastra Memory から会話履歴を読み込みます：

```typescript showLineNumbers copy filename="app/api/initial-chat/route.ts"
import { mastra } from './mastra';
import { NextResponse } from 'next/server';
import { convertMessages } from '@mastra/core/agent';

const myAgent = mastra.getAgent('weatherAgent');

export async function GET() {
  const result = await myAgent.getMemory()?.query({
    threadId: 'user-session',
  });

  const messages = convertMessages(result?.uiMessages || []).to('AIV5.UI');
  return NextResponse.json(messages);
}
```

## React チャットインターフェース \{#react-chat-interface\}

AI SDK v5 の `useChat` フックを使ってフロントエンドを構築しましょう:

```typescript showLineNumbers copy filename="app/page.tsx"
"use client";

import { Message, useChat } from "@ai-sdk/react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Chat() {
  // 初期会話履歴を読み込む
  const { data: initialMessages = [] } = useSWR<Message[]>(
    "/api/initial-chat",
    fetcher,
  );

  // AI SDK v5でストリーミングチャットをセットアップ
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    initialMessages,
  });

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      {messages.map((m) => (
        <div
          key={m.id}
          className="whitespace-pre-wrap"
          style={{ marginTop: "1em" }}
        >
          <h3
            style={{
              fontWeight: "bold",
              color: m.role === "user" ? "green" : "yellow",
            }}
          >
            {m.role === "user" ? "ユーザー: " : "AI: "}
          </h3>
          {m.parts.map((p) => p.type === "text" && p.text).join("\n")}
        </div>
      ))}

      <form onSubmit={handleSubmit}>
        <input
          className="fixed dark:bg-zinc-900 bottom-0 w-full max-w-md p-2 mb-8 border border-zinc-300 dark:border-zinc-800 rounded shadow-xl"
          value={input}
          placeholder="天気について聞いてみてください..."
          onChange={handleInputChange}
        />
      </form>
    </div>
  );
}
```

## パッケージの設定 \{#package-configuration\}

必要な依存関係をインストールします：

注: ai-sdk v5 はまだベータ版です。ベータ期間中は、ai-sdk のベータ版と mastra のベータ版をインストールする必要があります。詳しくは[こちら](https://github.com/mastra-ai/mastra/issues/5470)をご覧ください。

```json showLineNumbers copy filename="package.json"
{
  "dependencies": {
    "@ai-sdk/openai": "2.0.0-beta.1",
    "@ai-sdk/react": "2.0.0-beta.1",
    "@mastra/core": "0.0.0-ai-v5-20250625173645",
    "@mastra/libsql": "0.0.0-ai-v5-20250625173645",
    "@mastra/memory": "0.0.0-ai-v5-20250625173645",
    "next": "15.1.7",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "swr": "^2.3.3",
    "zod": "^3.25.67"
  }
}
```

## 主要な連携ポイント \{#key-integration-points\}

### 実験的な stream 形式のサポート \{#experimental-stream-format-support\}

`format: 'aisdk'` を指定する実験的な `stream` メソッドは、AI SDK v5 にネイティブ対応しています：

```typescript
// AI SDK v5形式でstreamを使用
const stream = await agent.stream(messages, {
  format: 'aisdk', // AISDKV5OutputStreamを返す
});

// AI SDK v5インターフェースと直接互換
return stream.toUIMessageStreamResponse();
```

### メモリの永続化 \{#memory-persistence\}

会話は Mastra Memory によって自動的に保存されます:

* 各会話には固有の `threadId` が割り当てられます
* ページを更新すると、履歴は `/api/initial-chat` を介して読み込まれます
* 新しいメッセージはエージェントが自動的に保存します

### ツール統合 \{#tool-integration\}

天気ツールはシームレスに統合されています：

* 天気情報が必要な際は、エージェントが自動的にツールを呼び出します
* リアルタイムデータは外部のAPIから取得されます
* 構造化された出力により、一貫した応答が得られます

## サンプルを実行する \{#running-the-example\}

1. OpenAI API キーを設定する：

```bash
echo "OPENAI_API_KEY=your_key_here" > .env.local
```

2. 開発サーバーを起動する：

```bash
pnpm dev
```

3. `http://localhost:3000` にアクセスして、さまざまな都市の天気を聞いてみましょう！

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/mastra/tree/main/examples/ai-sdk-v5"
}
/>
