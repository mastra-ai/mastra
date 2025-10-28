---
title: "Synthetic"
description: "Mastra で Synthetic モデルを利用する。利用可能なモデルは 21 個。"
---

# <img src="https://models.dev/logos/synthetic.svg" alt="Synthetic logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Synthetic \{#synthetic\}

Mastra のモデルルーター経由で、21 個の Synthetic モデルにアクセスできます。認証は `SYNTHETIC_API_KEY` 環境変数により自動で行われます。

詳しくは [Synthetic のドキュメント](https://synthetic.new/pricing)をご覧ください。

```bash
SYNTHETIC_API_KEY=your-api-key
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは親切で頼りになるアシスタントです',
  model: 'synthetic/hf:Qwen/Qwen2.5-Coder-32B-Instruct',
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

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを使用します。プロバイダー固有の機能の一部は利用できない場合があります。詳細は [Synthetic のドキュメント](https://synthetic.new/pricing) をご確認ください。

:::

## モデル \{#models\}

<ProviderModelsTable
  models={[
{
"model": "synthetic/hf:Qwen/Qwen3-235B-A22B-Instruct-2507",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 256000,
"maxOutput": 32000,
"inputCost": 0.2,
"outputCost": 0.6
},
{
"model": "synthetic/hf:Qwen/Qwen2.5-Coder-32B-Instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": false,
"reasoning": false,
"contextWindow": 32768,
"maxOutput": 32768,
"inputCost": 0.8,
"outputCost": 0.8
},
{
"model": "synthetic/hf:Qwen/Qwen3-Coder-480B-A35B-Instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 256000,
"maxOutput": 32000,
"inputCost": 2,
"outputCost": 2
},
{
"model": "synthetic/hf:Qwen/Qwen3-235B-A22B-Thinking-2507",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 256000,
"maxOutput": 32000,
"inputCost": 0.65,
"outputCost": 3
},
{
"model": "synthetic/hf:meta-llama/Llama-3.1-70B-Instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 128000,
"maxOutput": 32768,
"inputCost": 0.9,
"outputCost": 0.9
},
{
"model": "synthetic/hf:meta-llama/Llama-3.1-8B-Instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 128000,
"maxOutput": 32768,
"inputCost": 0.2,
"outputCost": 0.2
},
{
"model": "synthetic/hf:meta-llama/Llama-3.3-70B-Instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 128000,
"maxOutput": 32768,
"inputCost": 0.9,
"outputCost": 0.9
},
{
"model": "synthetic/hf:meta-llama/Llama-4-Scout-17B-16E-Instruct",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 328000,
"maxOutput": 4096,
"inputCost": 0.15,
"outputCost": 0.6
},
{
"model": "synthetic/hf:meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 524000,
"maxOutput": 4096,
"inputCost": 0.22,
"outputCost": 0.88
},
{
"model": "synthetic/hf:meta-llama/Llama-3.1-405B-Instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 128000,
"maxOutput": 32768,
"inputCost": 3,
"outputCost": 3
},
{
"model": "synthetic/hf:moonshotai/Kimi-K2-Instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 32768,
"inputCost": 0.6,
"outputCost": 2.5
},
{
"model": "synthetic/hf:moonshotai/Kimi-K2-Instruct-0905",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 262144,
"maxOutput": 32768,
"inputCost": 1.2,
"outputCost": 1.2
},
{
"model": "synthetic/hf:zai-org/GLM-4.5",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 128000,
"maxOutput": 96000,
"inputCost": 0.55,
"outputCost": 2.19
},
{
"model": "synthetic/hf:zai-org/GLM-4.6",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 200000,
"maxOutput": 96000,
"inputCost": 0.55,
"outputCost": 2.19
},
{
"model": "synthetic/hf:deepseek-ai/DeepSeek-R1",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 128000,
"maxOutput": 128000,
"inputCost": 0.55,
"outputCost": 2.19
},
{
"model": "synthetic/hf:deepseek-ai/DeepSeek-R1-0528",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 128000,
"maxOutput": 128000,
"inputCost": 3,
"outputCost": 8
},
{
"model": "synthetic/hf:deepseek-ai/DeepSeek-V3.1-Terminus",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 128000,
"maxOutput": 128000,
"inputCost": 1.2,
"outputCost": 1.2
},
{
"model": "synthetic/hf:deepseek-ai/DeepSeek-V3",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 128000,
"maxOutput": 128000,
"inputCost": 1.25,
"outputCost": 1.25
},
{
"model": "synthetic/hf:deepseek-ai/DeepSeek-V3.1",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 128000,
"maxOutput": 128000,
"inputCost": 0.56,
"outputCost": 1.68
},
{
"model": "synthetic/hf:deepseek-ai/DeepSeek-V3-0324",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 128000,
"inputCost": 1.2,
"outputCost": 1.2
},
{
"model": "synthetic/hf:openai/gpt-oss-120b",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 128000,
"maxOutput": 32768,
"inputCost": 0.1,
"outputCost": 0.1
}
]}
/>

## 詳細設定 \{#advanced-configuration\}

### カスタムヘッダー \{#custom-headers\}

```typescript
const agent = new Agent({
  name: 'custom-agent',
  model: {
    url: 'https://api.synthetic.new/v1',
    modelId: 'hf:Qwen/Qwen2.5-Coder-32B-Instruct',
    apiKey: process.env.SYNTHETIC_API_KEY,
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
    return useAdvanced ? 'synthetic/hf:zai-org/GLM-4.6' : 'synthetic/hf:Qwen/Qwen2.5-Coder-32B-Instruct';
  },
});
```
