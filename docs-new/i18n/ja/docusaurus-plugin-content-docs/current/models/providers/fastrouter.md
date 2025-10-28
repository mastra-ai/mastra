---
title: "FastRouter "
description: "Mastra で FastRouter モデルを利用する。利用可能なモデルは 14 件。"
---

# <img src="https://models.dev/logos/fastrouter.svg" alt="FastRouter logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />FastRouter \{#fastrouter\}

Mastraのモデルルーターを介して、14のFastRouterモデルにアクセスできます。認証は `FASTROUTER_API_KEY` 環境変数により自動で行われます。

詳しくは[FastRouterのドキュメント](https://fastrouter.ai/models)をご覧ください。

```bash
FASTROUTER_API_KEY=your-api-key
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは親切なアシスタントです',
  model: 'fastrouter/anthropic/claude-opus-4.1',
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

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを使用します。プロバイダ固有の機能の一部は利用できない場合があります。詳細は [FastRouter のドキュメント](https://fastrouter.ai/models)をご確認ください。

:::

## モデル \{#models\}

<ProviderModelsTable
  models={[
{
"model": "fastrouter/moonshotai/kimi-k2",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 131072,
"maxOutput": 32768,
"inputCost": 0.55,
"outputCost": 2.2
},
{
"model": "fastrouter/x-ai/grok-4",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 256000,
"maxOutput": 64000,
"inputCost": 3,
"outputCost": 15
},
{
"model": "fastrouter/google/gemini-2.5-flash",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 1048576,
"maxOutput": 65536,
"inputCost": 0.3,
"outputCost": 2.5
},
{
"model": "fastrouter/google/gemini-2.5-pro",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 1048576,
"maxOutput": 65536,
"inputCost": 1.25,
"outputCost": 10
},
{
"model": "fastrouter/openai/gpt-5-nano",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 400000,
"maxOutput": 128000,
"inputCost": 0.05,
"outputCost": 0.4
},
{
"model": "fastrouter/openai/gpt-4.1",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 1047576,
"maxOutput": 32768,
"inputCost": 2,
"outputCost": 8
},
{
"model": "fastrouter/openai/gpt-5-mini",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 400000,
"maxOutput": 128000,
"inputCost": 0.25,
"outputCost": 2
},
{
"model": "fastrouter/openai/gpt-oss-20b",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 131072,
"maxOutput": 65536,
"inputCost": 0.05,
"outputCost": 0.2
},
{
"model": "fastrouter/openai/gpt-oss-120b",
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
"model": "fastrouter/openai/gpt-5",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 400000,
"maxOutput": 128000,
"inputCost": 1.25,
"outputCost": 10
},
{
"model": "fastrouter/qwen/qwen3-coder",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 262144,
"maxOutput": 66536,
"inputCost": 0.3,
"outputCost": 1.2
},
{
"model": "fastrouter/anthropic/claude-opus-4.1",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 200000,
"maxOutput": 32000,
"inputCost": 15,
"outputCost": 75
},
{
"model": "fastrouter/anthropic/claude-sonnet-4",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 200000,
"maxOutput": 64000,
"inputCost": 3,
"outputCost": 15
},
{
"model": "fastrouter/deepseek-ai/deepseek-r1-distill-llama-70b",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": false,
"reasoning": true,
"contextWindow": 131072,
"maxOutput": 131072,
"inputCost": 0.03,
"outputCost": 0.14
}
]}
/>

## 詳細設定 \{#advanced-configuration\}

### カスタムヘッダ \{#custom-headers\}

```typescript
const agent = new Agent({
  name: 'custom-agent',
  model: {
    url: 'https://go.fastrouter.ai/api/v1',
    modelId: 'anthropic/claude-opus-4.1',
    apiKey: process.env.FASTROUTER_API_KEY,
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
    return useAdvanced ? 'fastrouter/x-ai/grok-4' : 'fastrouter/anthropic/claude-opus-4.1';
  },
});
```
