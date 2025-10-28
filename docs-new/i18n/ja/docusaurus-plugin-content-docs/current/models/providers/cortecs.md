---
title: "Cortecs "
description: "Mastra で Cortecs のモデルを利用できます。利用可能なモデルは 10 件です。"
---

# <img src="https://models.dev/logos/cortecs.svg" alt="Cortecs logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Cortecs \{#cortecs\}

Mastraのモデルルーター経由で、10個のCortecsモデルにアクセスできます。認証は `CORTECS_API_KEY` 環境変数により自動で行われます。

詳しくは[Cortecsのドキュメント](https://cortecs.ai)をご覧ください。

```bash
CORTECS_API_KEY=your-api-key
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは親切で頼りになるアシスタントです',
  model: 'cortecs/claude-sonnet-4',
});

// Generate a response
const response = await agent.generate('こんにちは！');

// Stream a response
const stream = await agent.stream('何か物語を聞かせて');
for await (const chunk of stream) {
  console.log(chunk);
}
```

:::note OpenAI 互換性

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを使用します。プロバイダー特有の一部機能は利用できない場合があります。詳細は [Cortecs のドキュメント](https://cortecs.ai)をご確認ください。

:::

## モデル \{#models\}

<ProviderModelsTable
  models={[
{
"model": "cortecs/nova-pro-v1",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 300000,
"maxOutput": 5000,
"inputCost": 0.824,
"outputCost": 3.295
},
{
"model": "cortecs/deepseek-v3-0324",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 128000,
"inputCost": 0.447,
"outputCost": 1.342
},
{
"model": "cortecs/kimi-k2-instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 131000,
"maxOutput": 131000,
"inputCost": 0.447,
"outputCost": 2.147
},
{
"model": "cortecs/gpt-4.1",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 1047576,
"maxOutput": 32768,
"inputCost": 1.91,
"outputCost": 7.64
},
{
"model": "cortecs/gemini-2.5-pro",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 1048576,
"maxOutput": 65535,
"inputCost": 1.3416,
"outputCost": 8.944
},
{
"model": "cortecs/gpt-oss-120b",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 128000,
"inputCost": null,
"outputCost": null
},
{
"model": "cortecs/qwen3-coder-480b-a35b-instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 262000,
"maxOutput": 262000,
"inputCost": 0.358,
"outputCost": 1.61
},
{
"model": "cortecs/claude-sonnet-4",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 200000,
"maxOutput": 64000,
"inputCost": 2.683,
"outputCost": 13.416
},
{
"model": "cortecs/llama-3.1-405b-instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 128000,
"inputCost": null,
"outputCost": null
},
{
"model": "cortecs/qwen3-32b",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 16384,
"maxOutput": 16384,
"inputCost": 0.08,
"outputCost": 0.268
}
]}
/>

## 詳細設定 \{#advanced-configuration\}

### カスタムヘッダー \{#custom-headers\}

```typescript
const agent = new Agent({
  name: 'custom-agent',
  model: {
    url: 'https://api.cortecs.ai/v1',
    modelId: 'claude-sonnet-4',
    apiKey: process.env.CORTECS_API_KEY,
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
    return useAdvanced ? 'cortecs/qwen3-coder-480b-a35b-instruct' : 'cortecs/claude-sonnet-4';
  },
});
```
