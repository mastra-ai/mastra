---
title: "Moonshot AI"
description: "Mastra で Moonshot AI のモデルを利用。利用可能なモデルは 3 つ。"
---

# <img src="https://models.dev/logos/moonshotai.svg" alt="Moonshot AI logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Moonshot AI \{#moonshot-ai\}

Mastraのモデルルーター経由で、3つのMoonshot AIモデルにアクセスできます。認証は環境変数 `MOONSHOT_API_KEY` により自動的に行われます。

詳しくは [Moonshot AIのドキュメント](https://platform.moonshot.ai) をご覧ください。

```bash
MOONSHOT_API_KEY=your-api-key
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは親切なアシスタントです',
  model: 'moonshotai/kimi-k2-0711-preview',
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

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを利用しています。プロバイダー固有の機能の一部は利用できない場合があります。詳しくは [Moonshot AI のドキュメント](https://platform.moonshot.ai)をご確認ください。

:::

## モデル \{#models\}

<ProviderModelsTable
  models={[
{
"model": "moonshotai/kimi-k2-turbo-preview",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 262144,
"maxOutput": 262144,
"inputCost": 2.4,
"outputCost": 10
},
{
"model": "moonshotai/kimi-k2-0711-preview",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 131072,
"maxOutput": 16384,
"inputCost": 0.6,
"outputCost": 2.5
},
{
"model": "moonshotai/kimi-k2-0905-preview",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 262144,
"maxOutput": 262144,
"inputCost": 0.6,
"outputCost": 2.5
}
]}
/>

## 詳細設定 \{#advanced-configuration\}

### カスタムヘッダー \{#custom-headers\}

```typescript
const agent = new Agent({
  name: 'custom-agent',
  model: {
    url: 'https://api.moonshot.ai/v1',
    modelId: 'kimi-k2-0711-preview',
    apiKey: process.env.MOONSHOT_API_KEY,
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
    return useAdvanced ? 'moonshotai/kimi-k2-turbo-preview' : 'moonshotai/kimi-k2-0711-preview';
  },
});
```
