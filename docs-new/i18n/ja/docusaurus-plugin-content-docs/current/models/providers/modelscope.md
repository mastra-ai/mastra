---
title: "ModelScope "
description: "Mastra で ModelScope のモデルを利用。利用可能なモデルは 7 件。"
---

# <img src="https://models.dev/logos/modelscope.svg" alt="ModelScope logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />ModelScope \{#modelscope\}

Mastra のモデルルーター経由で 7 つの ModelScope モデルにアクセスできます。認証は `MODELSCOPE_API_KEY` 環境変数により自動的に行われます。

詳しくは [ModelScope ドキュメント](https://modelscope.cn/docs/model-service/API-Inference/intro)をご覧ください。

```bash
MODELSCOPE_API_KEY=your-api-key
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは親切なアシスタントです',
  model: 'modelscope/Qwen/Qwen3-235B-A22B-Instruct-2507',
});

// レスポンスを生成
const response = await agent.generate('Hello!');

// レスポンスをストリーミング
const stream = await agent.stream('物語を聞かせて');
for await (const chunk of stream) {
  console.log(chunk);
}
```

:::note OpenAI 互換性

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを使用します。プロバイダー固有の機能の一部は利用できない場合があります。詳細は [ModelScope のドキュメント](https://modelscope.cn/docs/model-service/API-Inference/intro)をご確認ください。

:::

## モデル \{#models\}

<ProviderModelsTable
  models={[
{
"model": "modelscope/ZhipuAI/GLM-4.5",
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
"model": "modelscope/Qwen/Qwen3-30B-A3B-Thinking-2507",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 262144,
"maxOutput": 32768,
"inputCost": null,
"outputCost": null
},
{
"model": "modelscope/Qwen/Qwen3-235B-A22B-Instruct-2507",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 262144,
"maxOutput": 131072,
"inputCost": null,
"outputCost": null
},
{
"model": "modelscope/Qwen/Qwen3-Coder-30B-A3B-Instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 262144,
"maxOutput": 65536,
"inputCost": null,
"outputCost": null
},
{
"model": "modelscope/Qwen/Qwen3-Coder-480B-A35B-Instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 262144,
"maxOutput": 66536,
"inputCost": null,
"outputCost": null
},
{
"model": "modelscope/Qwen/Qwen3-30B-A3B-Instruct-2507",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 262144,
"maxOutput": 16384,
"inputCost": null,
"outputCost": null
},
{
"model": "modelscope/Qwen/Qwen3-235B-A22B-Thinking-2507",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 262144,
"maxOutput": 131072,
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
    url: 'https://api-inference.modelscope.cn/v1',
    modelId: 'Qwen/Qwen3-235B-A22B-Instruct-2507',
    apiKey: process.env.MODELSCOPE_API_KEY,
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
    return useAdvanced ? 'modelscope/ZhipuAI/GLM-4.5' : 'modelscope/Qwen/Qwen3-235B-A22B-Instruct-2507';
  },
});
```
