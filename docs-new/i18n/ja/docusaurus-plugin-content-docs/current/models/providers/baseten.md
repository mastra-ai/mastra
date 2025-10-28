---
title: "Baseten "
description: "Mastra で Baseten のモデルを利用する。利用可能なモデルは 2 つ。"
---

# <img src="https://models.dev/logos/baseten.svg" alt="Baseten logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Baseten \{#baseten\}

Mastra のモデルルーター経由で 2 つの Baseten モデルにアクセスできます。認証は `BASETEN_API_KEY` 環境変数により自動的に行われます。

詳細は [Baseten のドキュメント](https://docs.baseten.co/development/model-apis/overview) を参照してください。

```bash
BASETEN_API_KEY=あなたのAPIキー
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは親切なアシスタントです',
  model: 'baseten/Qwen3/Qwen3-Coder-480B-A35B-Instruct',
});

// レスポンスを生成
const response = await agent.generate('こんにちは!');

// レスポンスをストリーミング
const stream = await agent.stream('物語を聞かせて');
for await (const chunk of stream) {
  console.log(chunk);
}
```

:::note OpenAI 互換性

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを使用します。プロバイダー固有の機能の一部は利用できない場合があります。詳細は [Baseten のドキュメント](https://docs.baseten.co/development/model-apis/overview) をご確認ください。

:::

## モデル \{#models\}

<ProviderModelsTable
  models={[
{
"model": "baseten/moonshotai/Kimi-K2-Instruct-0905",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 262144,
"maxOutput": 262144,
"inputCost": 0.6,
"outputCost": 2.5
},
{
"model": "baseten/Qwen3/Qwen3-Coder-480B-A35B-Instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 262144,
"maxOutput": 66536,
"inputCost": 0.38,
"outputCost": 1.53
}
]}
/>

## 詳細設定 \{#advanced-configuration\}

### カスタムヘッダー \{#custom-headers\}

```typescript
const agent = new Agent({
  name: 'custom-agent',
  model: {
    url: 'https://inference.baseten.co/v1',
    modelId: 'Qwen3/Qwen3-Coder-480B-A35B-Instruct',
    apiKey: process.env.BASETEN_API_KEY,
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
    return useAdvanced ? 'baseten/moonshotai/Kimi-K2-Instruct-0905' : 'baseten/Qwen3/Qwen3-Coder-480B-A35B-Instruct';
  },
});
```
