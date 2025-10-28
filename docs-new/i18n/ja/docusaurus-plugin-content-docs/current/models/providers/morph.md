---
title: "Morph "
description: "Mastra で Morph モデルを利用する。利用可能なモデルは 3 種類。"
---

# <img src="https://models.dev/logos/morph.svg" alt="Morph logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Morph \{#morph\}

Mastra のモデルルーター経由で、3 種類の Morph モデルにアクセスできます。認証は `MORPH_API_KEY` 環境変数によって自動的に行われます。

詳しくは [Morph のドキュメント](https://docs.morphllm.com)をご覧ください。

```bash
MORPH_API_KEY=自分のAPIキー
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは親切なアシスタントです',
  model: 'morph/auto',
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

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを使用しています。プロバイダー固有の機能の一部は利用できない場合があります。詳細は [Morph ドキュメント](https://docs.morphllm.com) をご確認ください。

:::

## モデル \{#models\}

<ProviderModelsTable
  models={[
{
"model": "morph/morph-v3-large",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": false,
"reasoning": false,
"contextWindow": 32000,
"maxOutput": 32000,
"inputCost": 0.9,
"outputCost": 1.9
},
{
"model": "morph/auto",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": false,
"reasoning": false,
"contextWindow": 32000,
"maxOutput": 32000,
"inputCost": 0.85,
"outputCost": 1.55
},
{
"model": "morph/morph-v3-fast",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": false,
"reasoning": false,
"contextWindow": 16000,
"maxOutput": 16000,
"inputCost": 0.8,
"outputCost": 1.2
}
]}
/>

## 高度な設定 \{#advanced-configuration\}

### カスタムヘッダー \{#custom-headers\}

```typescript
const agent = new Agent({
  name: 'custom-agent',
  model: {
    url: 'https://api.morphllm.com/v1',
    modelId: 'auto',
    apiKey: process.env.MORPH_API_KEY,
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
    return useAdvanced ? 'morph/morph-v3-large' : 'morph/auto';
  },
});
```
