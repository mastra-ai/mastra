---
title: "サブモデル"
description: "Mastra でサブモデルを利用します。利用可能なモデルは 9 件あります。"
---

# <img src="https://models.dev/logos/submodel.svg" alt="submodel logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />submodel \{#submodel\}

Mastra のモデルルーター経由で、9種類の submodel モデルにアクセスできます。認証は `SUBMODEL_INSTAGEN_ACCESS_KEY` 環境変数により自動的に処理されます。

詳しくは [submodel のドキュメント](https://submodel.gitbook.io)をご覧ください。

```bash
SUBMODEL_INSTAGEN_ACCESS_KEY=your-api-key
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは親切なアシスタントです',
  model: 'submodel/Qwen/Qwen3-235B-A22B-Instruct-2507',
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

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを使用します。プロバイダー固有の機能の一部は利用できない場合があります。詳細は [submodel のドキュメント](https://submodel.gitbook.io) を参照してください。

:::

## モデル \{#models\}

<ProviderModelsTable
  models={[
{
"model": "submodel/openai/gpt-oss-120b",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 131072,
"maxOutput": 32768,
"inputCost": 0.1,
"outputCost": 0.5
},
{
"model": "submodel/Qwen/Qwen3-235B-A22B-Instruct-2507",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 262144,
"maxOutput": 131072,
"inputCost": 0.2,
"outputCost": 0.3
},
{
"model": "submodel/Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 262144,
"maxOutput": 262144,
"inputCost": 0.2,
"outputCost": 0.8
},
{
"model": "submodel/Qwen/Qwen3-235B-A22B-Thinking-2507",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 262144,
"maxOutput": 131072,
"inputCost": 0.2,
"outputCost": 0.6
},
{
"model": "submodel/zai-org/GLM-4.5-FP8",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 131072,
"maxOutput": 131072,
"inputCost": 0.2,
"outputCost": 0.8
},
{
"model": "submodel/zai-org/GLM-4.5-Air",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 131072,
"maxOutput": 131072,
"inputCost": 0.1,
"outputCost": 0.5
},
{
"model": "submodel/deepseek-ai/DeepSeek-R1-0528",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 75000,
"maxOutput": 163840,
"inputCost": 0.5,
"outputCost": 2.15
},
{
"model": "submodel/deepseek-ai/DeepSeek-V3.1",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 75000,
"maxOutput": 163840,
"inputCost": 0.2,
"outputCost": 0.8
},
{
"model": "submodel/deepseek-ai/DeepSeek-V3-0324",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 75000,
"maxOutput": 163840,
"inputCost": 0.2,
"outputCost": 0.8
}
]}
/>

## 高度な設定 \{#advanced-configuration\}

### カスタムヘッダー \{#custom-headers\}

```typescript
const agent = new Agent({
  name: 'custom-agent',
  model: {
    url: 'https://llm.submodel.ai/v1',
    modelId: 'Qwen/Qwen3-235B-A22B-Instruct-2507',
    apiKey: process.env.SUBMODEL_INSTAGEN_ACCESS_KEY,
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
    return useAdvanced ? 'submodel/zai-org/GLM-4.5-FP8' : 'submodel/Qwen/Qwen3-235B-A22B-Instruct-2507';
  },
});
```
