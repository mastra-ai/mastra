---
sidebar_position: 2
title: "ツール：Stock Agent"
description: 指定したシンボルの前日の終値を取得するための、Mastra におけるシンプルな Stock Agent 作成ガイド。
---

import YouTube from '@site/src/components/YouTube';

# AI株式エージェントを作成する \{#building-an-ai-stock-agent\}

このガイドでは、指定した銘柄の前日の終値を取得するシンプルなエージェントを作成します。ツールの作成方法、それをエージェントに追加する手順、そしてエージェントを使って株価を取得する方法を学びます。

<YouTube id="rIaZ4l7y9wo" />

## 前提条件 \{#prerequisites\}

* Node.js `v20.0` 以降がインストールされていること
* サポート対象の [Model Provider](/docs/models/providers) の API キー
* 既存の Mastra プロジェクト（新規プロジェクトの作成は [インストールガイド](/docs/getting-started/installation) を参照してください）

## エージェントの作成 \{#creating-the-agent\}

Mastra でエージェントを作成するには、`Agent` クラスで定義してから、Mastra に登録します。

### エージェントを定義する \{#define-the-agent\}

新しいファイル `src/mastra/agents/stockAgent.ts` を作成し、エージェントを定義します。

```ts copy filename="src/mastra/agents/stockAgent.ts"
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

export const stockAgent = new Agent({
  name: '株価アシスタント',
  instructions:
    'あなたは最新の株価を提供する有用なアシスタントです。銘柄について質問されたら、株価ツールを使って価格を取得してください。',
  model: openai('gpt-4o-mini'),
});
```

### Mastra にエージェントを登録する \{#register-the-agent-with-mastra\}

`src/mastra/index.ts` ファイルでエージェントを登録します:

```ts copy filename="src/mastra/index.ts" {2, 5}
import { Mastra } from '@mastra/core';
import { stockAgent } from './agents/stockAgent';

export const mastra = new Mastra({
  agents: { stockAgent },
});
```

## 株価ツールの作成 \{#creating-the-stock-price-tool\}

現状では、Stock Agent は最新の株価を把握していません。これを解消するために、ツールを作成してエージェントに追加しましょう。

### ツールを定義する \{#define-the-tool\}

新しいファイル `src/mastra/tools/stockPrices.ts` を作成します。ファイル内で、指定した銘柄シンボルの前日の終値を取得する `stockPrices` ツールを追加します。

```ts filename="src/mastra/tools/stockPrices.ts"
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const getStockPrice = async (symbol: string) => {
  const data = await fetch(`https://mastra-stock-data.vercel.app/api/stock-data?symbol=${symbol}`).then(r => r.json());
  return data.prices['4. close'];
};

export const stockPrices = createTool({
  id: '株価の取得',
  inputSchema: z.object({
    symbol: z.string(),
  }),
  description: `指定した銘柄シンボルの直近の終値を取得します`,
  execute: async ({ context: { symbol } }) => {
    console.log('ツールを使って株価を取得します:', symbol);
    return {
      symbol,
      currentPrice: await getStockPrice(symbol),
    };
  },
});
```

### ツールを Stock Agent に追加する \{#add-the-tool-to-the-stock-agent\}

`src/mastra/agents/stockAgent.ts` 内で、新しく作成した `stockPrices` ツールをインポートし、エージェントに追加します。

```ts copy filename="src/mastra/agents/stockAgent.ts" {3, 10-12}
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { stockPrices } from '../tools/stockPrices';

export const stockAgent = new Agent({
  name: '株価エージェント',
  instructions:
    'あなたは最新の株価を提供する有用なアシスタントです。銘柄について聞かれたら、株価ツールを使って価格を取得してください。',
  model: openai('gpt-4o-mini'),
  tools: {
    stockPrices,
  },
});
```

## エージェントサーバーの実行 \{#running-the-agent-server\}

Mastra の API を介してエージェントと対話する方法を学びましょう。

### `mastra dev` の使用 \{#using-mastra-dev\}

`mastra dev` コマンドを使用して、エージェントをサービスとして実行できます。

```bash copy
mastra dev
```

これにより、登録済みのエージェントとやり取りするためのエンドポイントを公開するサーバーが起動します。[playground](/docs/getting-started/local-dev-playground)内で、UIを通して `stockAgent` と `stockPrices` ツールをテストできます。

### Stock Agent API へのアクセス \{#accessing-the-stock-agent-api\}

デフォルトでは、`mastra dev` は `http://localhost:4111` で実行されます。Stock エージェントは次の場所で利用できます：

```
POST http://localhost:4111/api/agents/stockAgent/generate
```

### `curl` を使ったエージェントとのやり取り \{#interacting-with-the-agent-via-curl\}

コマンドラインから `curl` を使ってエージェントとやり取りできます。

```bash copy
curl -X POST http://localhost:4111/api/agents/stockAgent/generate \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { "role": "user", "content": "アップル（AAPL）の現在の株価はいくらですか？" }
    ]
  }'
```

**想定されるレスポンス:**

次のような JSON レスポンスが返されます:

```json
{
  "text": "Apple（AAPL）の現在の株価は$174.55です。",
  "agent": "株式エージェント"
}
```

これは、エージェントがリクエストを正常に処理し、`stockPrices` ツールで株価を取得して結果を返したことを示しています。
