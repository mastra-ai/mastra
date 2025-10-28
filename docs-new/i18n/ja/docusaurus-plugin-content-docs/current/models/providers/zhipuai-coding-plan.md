---
title: "Zhipu AI Coding Plan"
description: "Mastra で Zhipu AI Coding Plan のモデルを利用する。利用可能なモデルは5件。"
---

# <img src="https://models.dev/logos/zhipuai-coding-plan.svg" alt="Zhipu AI Coding Plan logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Zhipu AI Coding Plan \{#zhipu-ai-coding-plan\}

Mastraのモデルルーターを通じて、Zhipu AI Coding Planの5つのモデルにアクセスできます。認証は `ZHIPU_API_KEY` 環境変数により自動的に行われます。

詳しくは [Zhipu AI Coding Plan のドキュメント](https://docs.bigmodel.cn/cn/coding-plan/overview) をご覧ください。

```bash
ZHIPU_API_KEY=your-api-key
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは親切なアシスタントです',
  model: 'zhipuai-coding-plan/glm-4.5',
});

// レスポンスを生成
const response = await agent.generate('こんにちは！');

// レスポンスをストリーミング
const stream = await agent.stream('物語を聞かせて');
for await (const chunk of stream) {
  console.log(chunk);
}
```

:::note OpenAI 互換性

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを使用します。プロバイダー固有の機能の一部は利用できない場合があります。詳しくは [Zhipu AI Coding Plan のドキュメント](https://docs.bigmodel.cn/cn/coding-plan/overview)をご確認ください。

:::

## モデル \{#models\}

<ProviderModelsTable
  models={[
{
"model": "zhipuai-coding-plan/glm-4.6",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 204800,
"maxOutput": 131072,
"inputCost": null,
"outputCost": null
},
{
"model": "zhipuai-coding-plan/glm-4.5v",
"imageInput": true,
"audioInput": false,
"videoInput": true,
"toolUsage": true,
"reasoning": true,
"contextWindow": 64000,
"maxOutput": 16384,
"inputCost": null,
"outputCost": null
},
{
"model": "zhipuai-coding-plan/glm-4.5-air",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 131072,
"maxOutput": 98304,
"inputCost": null,
"outputCost": null
},
{
"model": "zhipuai-coding-plan/glm-4.5",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 131072,
"maxOutput": 98304,
"inputCost": null,
"outputCost": null
},
{
"model": "zhipuai-coding-plan/glm-4.5-flash",
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

## 高度な設定 \{#advanced-configuration\}

### カスタムヘッダー \{#custom-headers\}

```typescript
const agent = new Agent({
  name: 'custom-agent',
  model: {
    url: 'https://open.bigmodel.cn/api/coding/paas/v4',
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
    return useAdvanced ? 'zhipuai-coding-plan/glm-4.6' : 'zhipuai-coding-plan/glm-4.5';
  },
});
```
