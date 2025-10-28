---
title: "Llama "
description: "MastraでLlamaモデルを利用する。利用可能なモデルは7種類。"
---

# <img src="https://models.dev/logos/llama.svg" alt="Llama logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Llama \{#llama\}

Mastra のモデルルーター経由で 7 種類の Llama モデルにアクセスできます。認証は `LLAMA_API_KEY` 環境変数により自動的に行われます。

詳しくは [Llama のドキュメント](https://llama.developer.meta.com/docs/models) をご覧ください。

```bash
LLAMA_API_KEY=あなたのAPIキー
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは頼りになるアシスタントです',
  model: 'llama/cerebras-llama-4-maverick-17b-128e-instruct',
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

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを使用します。プロバイダー固有の機能の一部は利用できない場合があります。詳細は [Llama ドキュメント](https://llama.developer.meta.com/docs/models) をご確認ください。

:::

## モデル \{#models\}

<ProviderModelsTable
  models={[
{
"model": "llama/llama-3.3-8b-instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 4096,
"inputCost": null,
"outputCost": null
},
{
"model": "llama/llama-4-maverick-17b-128e-instruct-fp8",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 4096,
"inputCost": null,
"outputCost": null
},
{
"model": "llama/llama-3.3-70b-instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 4096,
"inputCost": null,
"outputCost": null
},
{
"model": "llama/llama-4-scout-17b-16e-instruct-fp8",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 4096,
"inputCost": null,
"outputCost": null
},
{
"model": "llama/groq-llama-4-maverick-17b-128e-instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 4096,
"inputCost": null,
"outputCost": null
},
{
"model": "llama/cerebras-llama-4-scout-17b-16e-instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 4096,
"inputCost": null,
"outputCost": null
},
{
"model": "llama/cerebras-llama-4-maverick-17b-128e-instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 4096,
"inputCost": null,
"outputCost": null
}
]}
/>

## 詳細設定 \{#advanced-configuration\}

### カスタム ヘッダー \{#custom-headers\}

```typescript
const agent = new Agent({
  name: 'custom-agent',
  model: {
    url: 'https://api.llama.com/compat/v1/',
    modelId: 'cerebras-llama-4-maverick-17b-128e-instruct',
    apiKey: process.env.LLAMA_API_KEY,
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
      ? 'llama/llama-4-scout-17b-16e-instruct-fp8'
      : 'llama/cerebras-llama-4-maverick-17b-128e-instruct';
  },
});
```
