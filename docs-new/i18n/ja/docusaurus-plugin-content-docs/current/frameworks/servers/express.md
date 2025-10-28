---
title: "Express とともに"
description: Mastra を Express バックエンドに統合するためのステップバイステップガイド。
---

# Express プロジェクトに Mastra を統合する \{#integrate-mastra-in-your-express-project\}

Mastra は Express と連携し、次のことを簡単に行えます:

* AI 機能を提供する柔軟な API の構築
* サーバーのロジックやルーティングの完全な制御
* フロントエンドと独立したバックエンドのスケール

Express から Mastra を直接呼び出せるため、Express サーバーとは別に Mastra サーバーを起動する必要はありません。

このガイドでは、必要な Mastra の依存関係をインストールし、サンプルのエージェントを作成し、Express の API ルートから Mastra を呼び出す方法を説明します。

## 前提条件 \{#prerequisites\}

* TypeScript で構築された既存の Express アプリ
* Node.js `v20.0` 以上
* サポート対象の[モデルプロバイダー](/docs/models/providers)の API キー

## Mastra の追加 \{#adding-mastra\}

まず、エージェントを実行するために必要な Mastra の依存関係をインストールします。このガイドではモデルとして OpenAI を使用しますが、サポートされている任意の[モデルプロバイダー](/docs/models/providers)を利用できます。

```bash copy
npm install mastra@latest @mastra/core@latest @mastra/libsql@latest zod@^3.0.0 @ai-sdk/openai@^1.0.0
```

まだ存在しない場合は、`.env` ファイルを作成し、OpenAI の API キーを追加してください。

```bash filename=".env" copy
OPENAI_API_KEY=<your-api-key>
```

:::note

各LLMプロバイダーは異なる環境変数を使用します。詳しくは [Model Capabilities](/docs/models) をご覧ください。

:::

`src/mastra/index.ts` に Mastra の設定ファイルを作成します:

```ts filename="src/mastra/index.ts" copy
import { Mastra } from '@mastra/core/mastra';

export const mastra = new Mastra({});
```

`weatherAgent` が使用する `weatherTool` を `src/mastra/tools/weather-tool.ts` に作成します。`execute()` 関数内でプレースホルダー値を返します（ここに API 呼び出しを実装します）。

```ts filename="src/mastra/tools/weather-tool.ts" copy
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const weatherTool = createTool({
  id: 'get-weather',
  description: '指定した場所の現在の天気を取得します',
  inputSchema: z.object({
    location: z.string().describe('都市名'),
  }),
  outputSchema: z.object({
    output: z.string(),
  }),
  execute: async () => {
    return {
      output: '晴れです',
    };
  },
});
```

`src/mastra/agents/weather-agent.ts` に `weatherAgent` を追加する:

```ts filename="src/mastra/agents/weather-agent.ts" copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { weatherTool } from '../tools/weather-tool';

export const weatherAgent = new Agent({
  name: '天気エージェント',
  instructions: `
      あなたは正確な天気情報を提供する親切な天気アシスタントです。
 
      あなたの主な役割は、ユーザーが特定の場所の天気情報を取得できるよう支援することです。応答する際は以下に従ってください:
      - 場所が指定されていない場合は、必ず場所を尋ねてください
      - 場所名が英語でない場合は、英語に翻訳してください
      - 複数の部分で構成される場所(例:「ニューヨーク、NY」)を指定する場合は、最も関連性の高い部分(例:「ニューヨーク」)を使用してください
      - 湿度、風の状態、降水量などの関連情報を含めてください
      - 応答は簡潔かつ有益なものにしてください
 
      weatherToolを使用して現在の天気データを取得してください。
`,
  model: openai('gpt-4o-mini'),
  tools: { weatherTool },
});
```

最後に、`weatherAgent` を `src/mastra/index.ts` に追加します：

```ts filename="src/mastra/index.ts" copy {2, 5}
import { Mastra } from '@mastra/core/mastra';
import { weatherAgent } from './agents/weather-agent';

export const mastra = new Mastra({
  agents: { weatherAgent },
});
```

これでMastraのボイラープレートコードのセットアップが完了し、Expressのルートへ統合する準備が整いました。

## Express で Mastra を使う \{#using-mastra-with-express\}

`city` クエリパラメーターを受け取る `/api/weather` エンドポイントを作成します。`city` パラメーターは、プロンプトを通じて `weatherAgent` に渡されます。

既存のプロジェクトには、次のようなファイルがあるかもしれません。

```ts filename="src/server.ts" copy
import express, { Request, Response } from 'express';

const app = express();
const port = 3456;

app.get('/', (req: Request, res: Response) => {
  res.send('こんにちは、世界!');
});

app.listen(port, () => {
  console.log(`サーバーは http://localhost:${port} で実行中です`);
});
```

「/api/weather」エンドポイントを追加すると、次のようになります：

```ts filename="src/server.ts" copy {2, 11-27}
import express, { Request, Response } from 'express';
import { mastra } from './mastra';

const app = express();
const port = 3456;

app.get('/', (req: Request, res: Response) => {
  res.send('こんにちは、世界!');
});

app.get('/api/weather', async (req: Request, res: Response) => {
  const { city } = req.query as { city?: string };

  if (!city) {
    return res.status(400).send("'city'クエリパラメータが指定されていません");
  }

  const agent = mastra.getAgent('weatherAgent');

  try {
    const result = await agent.generate(`${city}の天気はどうですか?`);
    res.send(result.text);
  } catch (error) {
    console.error('エージェントエラー:', error);
    res.status(500).send('リクエストの処理中にエラーが発生しました');
  }
});

app.listen(port, () => {
  console.log(`サーバーは http://localhost:${port} で実行中です`);
});
```

`src/mastra/index.ts` ファイルをインポートすると、[`.getAgent()`](/docs/reference/core/getAgent) などのメソッドを使ってプログラムからアクセスできます。さらに、[`.generate()`](/docs/reference/agents/generate) を使えば、対応するエージェントと対話できます。

:::note

詳しくは [Agent リファレンス ドキュメント](/docs/reference/agents/agent) をご覧ください。

:::

Express サーバーを起動し、`/api/weather` エンドポイントにアクセスしてください。例:

```
http://localhost:3456/api/weather?city=London
```

次のような返答が返ってくるはずです：

```
ロンドンの天気は現在晴れています。湿度、風の状況、降水量などの詳細情報が必要でしたら、お気軽にお知らせください!
```

## エージェントサーバーの実行 \{#running-the-agent-server\}

本番環境では、Express サーバーと併せて Mastra を実行する必要はありません。ですが、開発時には Mastra の提供する [ローカル開発環境](/docs/getting-started/local-dev-playground) を利用して、エージェントの改善やデバッグを行えます。

`package.json` にスクリプトを追加します：

```json filename="package.json" copy
{
  "scripts": {
    "mastra:dev": "mastra dev"
  }
}
```

Mastra のプレイグラウンドを起動する:

```bash copy
npm run mastra:dev
```
