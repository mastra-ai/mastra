---
title: "Moonshot AI（中国）"
description: "Mastra で Moonshot AI（中国）のモデルを利用。利用可能なモデルは 3 種類。"
---

# <img src="https://models.dev/logos/moonshotai-cn.svg" alt="Moonshot AI (China) logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Moonshot AI (China) \{#moonshot-ai-china\}

Mastra のモデルルーターを通じて、3 つの Moonshot AI (China) モデルにアクセスできます。認証は `MOONSHOT_API_KEY` 環境変数により自動的に行われます。

詳しくは [Moonshot AI (China) のドキュメント](https://platform.moonshot.cn)をご覧ください。

```bash
MOONSHOT_API_KEY=your-api-key
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは親切なアシスタントです',
  model: 'moonshotai-cn/kimi-k2-0711-preview',
});

// レスポンスを生成
const response = await agent.generate('Hello!');

// レスポンスをストリーミング
const stream = await agent.stream('Tell me a story');
for await (const chunk of stream) {
  console.log(chunk);
}
```

:::note OpenAI 互換性

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを使用します。プロバイダー固有の機能の一部は利用できない場合があります。詳細は [Moonshot AI（中国）のドキュメント](https://platform.moonshot.cn)をご確認ください。

:::

## モデル \{#models\}

<ProviderModelsTable
  models={[
{
"model": "moonshotai-cn/kimi-k2-0905-preview",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 262144,
"maxOutput": 262144,
"inputCost": 0.6,
"outputCost": 2.5
},
{
"model": "moonshotai-cn/kimi-k2-0711-preview",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 131072,
"maxOutput": 16384,
"inputCost": 0.6,
"outputCost": 2.5
},
{
"model": "moonshotai-cn/kimi-k2-turbo-preview",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 262144,
"maxOutput": 262144,
"inputCost": 2.4,
"outputCost": 10
}
]}
/>

## 高度な設定 \{#advanced-configuration\}

### カスタムヘッダー \{#custom-headers\}

```typescript
const agent = new Agent({
  name: 'custom-agent',
  model: {
    url: 'https://api.moonshot.cn/v1',
    modelId: 'kimi-k2-0711-preview',
    apiKey: process.env.MOONSHOT_API_KEY,
    headers: {
      'X-Custom-Header': 'value',
    },
  },
});
```

### 動的モデル選択 \{#dynamic-model-selection\}

```typescript
const agent = new Agent({
  name: 'dynamic-agent',
  model: ({ runtimeContext }) => {
    const useAdvanced = runtimeContext.task === 'complex';
    return useAdvanced ? 'moonshotai-cn/kimi-k2-turbo-preview' : 'moonshotai-cn/kimi-k2-0711-preview';
  },
});
```
