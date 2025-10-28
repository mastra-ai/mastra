---
title: "Fireworks AI"
description: "Mastra で Fireworks AI のモデルを利用。10 種類のモデルが利用可能。"
---

# <img src="https://models.dev/logos/fireworks-ai.svg" alt="Fireworks AI logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Fireworks AI \{#fireworks-ai\}

Mastraのモデルルーター経由で、10種類のFireworks AIモデルにアクセスできます。認証は `FIREWORKS_API_KEY` 環境変数で自動的に行われます。

詳しくは[Fireworks AIのドキュメント](https://fireworks.ai/docs/)をご覧ください。

```bash
FIREWORKS_API_KEY=your-api-key
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは親切なアシスタントです',
  model: 'fireworks-ai/accounts/fireworks/models/deepseek-r1-0528',
});

// レスポンスを生成
const response = await agent.generate('Hello!');

// レスポンスをストリーミング
const stream = await agent.stream('物語を聞かせて');
for await (const chunk of stream) {
  console.log(chunk);
}
```

## モデル \{#models\}

<ProviderModelsTable
  models={[
{
"model": "fireworks-ai/accounts/fireworks/models/deepseek-r1-0528",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 160000,
"maxOutput": 16384,
"inputCost": 3,
"outputCost": 8
},
{
"model": "fireworks-ai/accounts/fireworks/models/deepseek-v3p1",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 163840,
"maxOutput": 163840,
"inputCost": 0.56,
"outputCost": 1.68
},
{
"model": "fireworks-ai/accounts/fireworks/models/deepseek-v3-0324",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 160000,
"maxOutput": 16384,
"inputCost": 0.9,
"outputCost": 0.9
},
{
"model": "fireworks-ai/accounts/fireworks/models/kimi-k2-instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 16384,
"inputCost": 1,
"outputCost": 3
},
{
"model": "fireworks-ai/accounts/fireworks/models/qwen3-235b-a22b",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 128000,
"maxOutput": 16384,
"inputCost": 0.22,
"outputCost": 0.88
},
{
"model": "fireworks-ai/accounts/fireworks/models/gpt-oss-20b",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 131072,
"maxOutput": 32768,
"inputCost": 0.05,
"outputCost": 0.2
},
{
"model": "fireworks-ai/accounts/fireworks/models/gpt-oss-120b",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 131072,
"maxOutput": 32768,
"inputCost": 0.15,
"outputCost": 0.6
},
{
"model": "fireworks-ai/accounts/fireworks/models/glm-4p5-air",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 131072,
"maxOutput": 131072,
"inputCost": 0.22,
"outputCost": 0.88
},
{
"model": "fireworks-ai/accounts/fireworks/models/qwen3-coder-480b-a35b-instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 256000,
"maxOutput": 32768,
"inputCost": 0.45,
"outputCost": 1.8
},
{
"model": "fireworks-ai/accounts/fireworks/models/glm-4p5",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 131072,
"maxOutput": 131072,
"inputCost": 0.55,
"outputCost": 2.19
}
]}
/>

## 詳細設定 \{#advanced-configuration\}

### カスタムヘッダー \{#custom-headers\}

```typescript
const agent = new Agent({
  name: 'custom-agent',
  model: {
    url: 'https://api.fireworks.ai/inference/v1/chat/completions',
    modelId: 'accounts/fireworks/models/deepseek-r1-0528',
    apiKey: process.env.FIREWORKS_API_KEY,
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
    return useAdvanced
      ? 'fireworks-ai/accounts/fireworks/models/deepseek-r1-0528'
      : 'fireworks-ai/accounts/fireworks/models/deepseek-v3-0324';
  },
});
```
