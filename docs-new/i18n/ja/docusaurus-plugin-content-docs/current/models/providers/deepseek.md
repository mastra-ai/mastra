---
title: "DeepSeek "
description: "Mastra で DeepSeek モデルを利用。利用可能なモデルは2種類。"
---

# <img src="https://models.dev/logos/deepseek.svg" alt="DeepSeek logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />DeepSeek \{#deepseek\}

Mastra のモデルルーター経由で 2 種類の DeepSeek モデルにアクセスできます。認証は `DEEPSEEK_API_KEY` 環境変数により自動的に行われます。

詳しくは [DeepSeek のドキュメント](https://platform.deepseek.com)をご覧ください。

```bash
DEEPSEEK_API_KEY=あなたのAPIキー
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは親切なアシスタントです',
  model: 'deepseek/deepseek-chat',
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

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを使用します。プロバイダー固有の機能の一部は利用できない場合があります。詳細は [DeepSeek のドキュメント](https://platform.deepseek.com) をご確認ください。

:::

## モデル \{#models\}

<ProviderModelsTable
  models={[
{
"model": "deepseek/deepseek-chat",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 8192,
"inputCost": 0.57,
"outputCost": 1.68
},
{
"model": "deepseek/deepseek-reasoner",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 128000,
"maxOutput": 128000,
"inputCost": 0.57,
"outputCost": 1.68
}
]}
/>

## 詳細設定 \{#advanced-configuration\}

### カスタムヘッダー \{#custom-headers\}

```typescript
const agent = new Agent({
  name: 'custom-agent',
  model: {
    url: 'https://api.deepseek.com',
    modelId: 'deepseek-chat',
    apiKey: process.env.DEEPSEEK_API_KEY,
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
    return useAdvanced ? 'deepseek/deepseek-reasoner' : 'deepseek/deepseek-chat';
  },
});
```
