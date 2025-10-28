---
title: "Weights & Biases"
description: "Mastra で Weights & Biases のモデルを利用できます。利用可能なモデルは 10 件です。"
---

# <img src="https://models.dev/logos/wandb.svg" alt="Weights & Biases logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Weights &amp; Biases \{#weights-biases\}

Mastraのモデルルーター経由で、Weights &amp; Biasesのモデル10件にアクセスできます。認証は `WANDB_API_KEY` 環境変数により自動で行われます。

詳しくは[Weights &amp; Biasesのドキュメント](https://weave-docs.wandb.ai)をご覧ください。

```bash
WANDB_API_KEY=your-api-key
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは役に立つアシスタントです',
  model: 'wandb/Qwen/Qwen3-235B-A22B-Instruct-2507',
});

// レスポンスを生成
const response = await agent.generate('こんにちは!');

// レスポンスをストリーム
const stream = await agent.stream('物語を聞かせてください');
for await (const chunk of stream) {
  console.log(chunk);
}
```

:::note OpenAI 互換性

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを使用します。プロバイダーに固有の機能の一部は利用できない場合があります。詳しくは [Weights &amp; Biases のドキュメント](https://weave-docs.wandb.ai) をご確認ください。

:::

## モデル \{#models\}

<ProviderModelsTable
  models={[
{
"model": "wandb/moonshotai/Kimi-K2-Instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 16384,
"inputCost": 1.35,
"outputCost": 4
},
{
"model": "wandb/microsoft/Phi-4-mini-instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 128000,
"maxOutput": 4096,
"inputCost": 0.08,
"outputCost": 0.35
},
{
"model": "wandb/meta-llama/Llama-3.1-8B-Instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 128000,
"maxOutput": 32768,
"inputCost": 0.22,
"outputCost": 0.22
},
{
"model": "wandb/meta-llama/Llama-3.3-70B-Instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 128000,
"maxOutput": 32768,
"inputCost": 0.71,
"outputCost": 0.71
},
{
"model": "wandb/meta-llama/Llama-4-Scout-17B-16E-Instruct",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 64000,
"maxOutput": 8192,
"inputCost": 0.17,
"outputCost": 0.66
},
{
"model": "wandb/Qwen/Qwen3-235B-A22B-Instruct-2507",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 262144,
"maxOutput": 131072,
"inputCost": 0.1,
"outputCost": 0.1
},
{
"model": "wandb/Qwen/Qwen3-Coder-480B-A35B-Instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 262144,
"maxOutput": 66536,
"inputCost": 1,
"outputCost": 1.5
},
{
"model": "wandb/Qwen/Qwen3-235B-A22B-Thinking-2507",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 262144,
"maxOutput": 131072,
"inputCost": 0.1,
"outputCost": 0.1
},
{
"model": "wandb/deepseek-ai/DeepSeek-R1-0528",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 161000,
"maxOutput": 163840,
"inputCost": 1.35,
"outputCost": 5.4
},
{
"model": "wandb/deepseek-ai/DeepSeek-V3-0324",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 161000,
"maxOutput": 8192,
"inputCost": 1.14,
"outputCost": 2.75
}
]}
/>

## 詳細設定 \{#advanced-configuration\}

### カスタムヘッダー \{#custom-headers\}

```typescript
const agent = new Agent({
  name: 'custom-agent',
  model: {
    url: 'https://api.inference.wandb.ai/v1',
    modelId: 'Qwen/Qwen3-235B-A22B-Instruct-2507',
    apiKey: process.env.WANDB_API_KEY,
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
    return useAdvanced ? 'wandb/moonshotai/Kimi-K2-Instruct' : 'wandb/Qwen/Qwen3-235B-A22B-Instruct-2507';
  },
});
```
