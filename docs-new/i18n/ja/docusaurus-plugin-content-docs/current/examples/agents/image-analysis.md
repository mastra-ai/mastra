---
title: "画像解析エージェント"
description: Unsplash の画像を分析して物体を特定し、種を判別し、場所を記述するために Mastra AI エージェントを使用する例。
---

# 画像解析 \{#image-analysis\}

AI エージェントは、テキストによる指示とあわせて視覚コンテンツを処理することで、画像を分析し、理解できます。この能力により、エージェントは物体の特定、シーンの説明、画像に関する質問への回答、複雑な視覚的推論タスクの実行が可能になります。

## 前提条件 \{#prerequisites\}

* [Unsplash](https://unsplash.com/documentation#creating-a-developer-account) の開発者アカウント、アプリケーション、APIキー
* OpenAI APIキー

この例では `openai` モデルを使用します。`OPENAI_API_KEY` と `UNSPLASH_ACCESS_KEY` の両方を `.env` ファイルに追加してください。

```bash filename=".env" copy
OPENAI_API_KEY=<あなたの API キー>
UNSPLASH_ACCESS_KEY=<あなたの Unsplash アクセスキー>
```

## エージェントの作成 \{#creating-an-agent\}

画像を解析して物体を特定し、シーンを記述し、視覚コンテンツに関する質問に答えるシンプルなエージェントを作成します。

```typescript filename="src/mastra/agents/example-image-analysis-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

export const imageAnalysisAgent = new Agent({
  name: 'image-analysis',
  description: '画像を解析して物体を特定し、シーンを記述します',
  instructions: `
    画像を参照して物体を特定し、シーンを記述し、内容に関する質問に回答できます。
    動物の種を判別したり、画像内の場所を描写したりすることも可能です。
   `,
  model: openai('gpt-4o'),
});
```

> 設定オプションの全リストは [Agent](/docs/reference/agents/agent) を参照してください。

## エージェントの登録 \{#registering-an-agent\}

エージェントを使用するには、メインの Mastra インスタンスに登録してください。

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';

import { imageAnalysisAgent } from './agents/example-image-analysis-agent';

export const mastra = new Mastra({
  // 省略
  agents: { imageAnalysisAgent },
});
```

## 関数の作成 \{#creating-a-function\}

この関数は、エージェントが分析できるように、Unsplash からランダムな画像を取得して渡します。

```typescript filename="src/mastra/utils/get-random-image.ts" showLineNumbers copy
export const getRandomImage = async (): Promise<string> => {
  const queries = ['野生動物', '羽毛', '飛翔', '鳥'];
  const query = queries[Math.floor(Math.random() * queries.length)];
  const page = Math.floor(Math.random() * 20);
  const order_by = Math.random() < 0.5 ? 'relevant' : 'latest';

  const response = await fetch(
    `https://api.unsplash.com/search/photos?query=${query}&page=${page}&order_by=${order_by}`,
    {
      headers: {
        Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
        'Accept-Version': 'v1',
      },
      cache: 'no-store',
    },
  );

  const { results } = await response.json();
  return results[Math.floor(Math.random() * results.length)].urls.regular;
};
```

## 使用例 \{#example-usage\}

`getAgent()` を使ってエージェントへの参照を取得し、プロンプトとともに `generate()` を呼び出します。画像の `type`、`imageUrl`、`mimeType`、さらにエージェントの応答方法に関する明確な指示を含む `content` 配列を指定してください。

```typescript filename="src/test-image-analysis.ts" showLineNumbers copy
import 'dotenv/config';

import { mastra } from './mastra';
import { getRandomImage } from './mastra/utils/get-random-image';

const imageUrl = await getRandomImage();
const agent = mastra.getAgent('imageAnalysisAgent');

const response = await agent.generate([
  {
    role: 'user',
    content: [
      {
        type: 'image',
        image: imageUrl,
        mimeType: 'image/jpeg',
      },
      {
        type: 'text',
        text: `この画像を分析し、主要な対象物や被写体を特定してください。動物がいる場合は、その一般的な名称と学名を記してください。場所や状況については、短い文で1～2文程度で説明してください。`
      },
    ],
  },
]);

console.log(response.text);
```

<GithubLink outdated={true} marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/agents/bird-checker" />

## 関連 \{#related\}

* [エージェントの呼び出し](./calling-agents#from-the-command-line)