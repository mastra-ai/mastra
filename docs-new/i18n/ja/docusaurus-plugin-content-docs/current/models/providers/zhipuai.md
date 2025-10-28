---
title: "Zhipu AI"
description: "Mastra で Zhipu AI のモデルを利用できます。利用可能なモデルは5種類です。"
---

# <img src="https://models.dev/logos/zhipuai.svg" alt="Zhipu AI logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Zhipu AI \{#zhipu-ai\}

Mastraのモデルルーターを通じて、5つのZhipu AIモデルにアクセスできます。認証は、環境変数 `ZHIPU_API_KEY` を使用して自動的に行われます。

詳しくは [Zhipu AIのドキュメント](https://docs.z.ai/guides/overview/pricing) をご覧ください。

```bash
ZHIPU_API_KEY=your-api-key
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは頼りになるアシスタントです',
  model: 'zhipuai/glm-4.5',
});

// Generate a response
const response = await agent.generate('こんにちは！');

// Stream a response
const stream = await agent.stream('物語を聞かせてください');
for await (const chunk of stream) {
  console.log(chunk);
}
```

:::note OpenAI 互換性

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを使用します。プロバイダー固有の機能の一部は利用できない場合があります。詳細は [Zhipu AI のドキュメント](https://docs.z.ai/guides/overview/pricing)をご確認ください。

:::

## モデル \{#models\}

<ProviderModelsTable
  models={[
{
"model": "zhipuai/glm-4.6",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 204800,
"maxOutput": 131072,
"inputCost": 0.6,
"outputCost": 2.2
},
{
"model": "zhipuai/glm-4.5v",
"imageInput": true,
"audioInput": false,
"videoInput": true,
"toolUsage": true,
"reasoning": true,
"contextWindow": 64000,
"maxOutput": 16384,
"inputCost": 0.6,
"outputCost": 1.8
},
{
"model": "zhipuai/glm-4.5-air",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 131072,
"maxOutput": 98304,
"inputCost": 0.2,
"outputCost": 1.1
},
{
"model": "zhipuai/glm-4.5",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 131072,
"maxOutput": 98304,
"inputCost": 0.6,
"outputCost": 2.2
},
{
"model": "zhipuai/glm-4.5-flash",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 131072,
"maxOutput": 98304,
"inputCost": null,
"outputCost": null
}
]}
/>

## 詳細設定 \{#advanced-configuration\}

### カスタムヘッダー \{#custom-headers\}

```typescript
const agent = new Agent({
  name: 'custom-agent',
  model: {
    url: 'https://open.bigmodel.cn/api/paas/v4',
    modelId: 'glm-4.5',
    apiKey: process.env.ZHIPU_API_KEY,
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
    return useAdvanced ? 'zhipuai/glm-4.6' : 'zhipuai/glm-4.5';
  },
});
```
