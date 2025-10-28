---
title: "Inception "
description: "Mastra で Inception モデルを利用する。利用可能なモデルは 2 つ。"
---

# <img src="https://models.dev/logos/inception.svg" alt="Inception logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Inception \{#inception\}

Mastra のモデルルーター経由で 2 つの Inception モデルにアクセスできます。認証は `INCEPTION_API_KEY` 環境変数で自動的に行われます。

詳しくは [Inception のドキュメント](https://platform.inceptionlabs.ai/docs) をご覧ください。

```bash
INCEPTION_API_KEY=your-api-key
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは親切なアシスタントです',
  model: 'inception/mercury',
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

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを使用します。プロバイダー固有の機能の一部は利用できない場合があります。詳細は [Inception のドキュメント](https://platform.inceptionlabs.ai/docs) をご確認ください。

:::

## モデル \{#models\}

<ProviderModelsTable
  models={[
{
"model": "inception/mercury-coder",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 16384,
"inputCost": 0.25,
"outputCost": 1
},
{
"model": "inception/mercury",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 16384,
"inputCost": 0.25,
"outputCost": 1
}
]}
/>

## 詳細設定 \{#advanced-configuration\}

### カスタムヘッダー \{#custom-headers\}

```typescript
const agent = new Agent({
  name: 'custom-agent',
  model: {
    url: 'https://api.inceptionlabs.ai/v1/',
    modelId: 'mercury',
    apiKey: process.env.INCEPTION_API_KEY,
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
    return useAdvanced ? 'inception/mercury-coder' : 'inception/mercury';
  },
});
```
