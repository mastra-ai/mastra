---
title: "LucidQuery AI"
description: "Mastra で LucidQuery AI モデルを利用できます。利用可能なモデルは2種類です。"
---

# <img src="https://models.dev/logos/lucidquery.svg" alt="LucidQuery AI logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />LucidQuery AI \{#lucidquery-ai\}

Mastra のモデルルーター経由で、2 つの LucidQuery AI モデルにアクセスできます。認証は `LUCIDQUERY_API_KEY` 環境変数を使用して自動的に行われます。

詳しくは [LucidQuery AI のドキュメント](https://lucidquery.com)をご覧ください。

```bash
LUCIDQUERY_API_KEY=your-api-key
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは親切なアシスタントです',
  model: 'lucidquery/lucidnova-rf1-100b',
});

// レスポンスを生成
const response = await agent.generate('Hello!');

// レスポンスをストリーム
const stream = await agent.stream('物語を聞かせてください');
for await (const chunk of stream) {
  console.log(chunk);
}
```

:::note OpenAI 互換性

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを使用します。プロバイダー固有の機能の一部は利用できない場合があります。詳細は [LucidQuery AI ドキュメント](https://lucidquery.com)をご確認ください。

:::

## モデル \{#models\}

<ProviderModelsTable
  models={[
{
"model": "lucidquery/lucidquery-nexus-coder",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 250000,
"maxOutput": 60000,
"inputCost": 2,
"outputCost": 5
},
{
"model": "lucidquery/lucidnova-rf1-100b",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 120000,
"maxOutput": 8000,
"inputCost": 2,
"outputCost": 5
}
]}
/>

## 詳細設定 \{#advanced-configuration\}

### カスタムヘッダー \{#custom-headers\}

```typescript
const agent = new Agent({
  name: 'custom-agent',
  model: {
    url: 'https://lucidquery.com/api/v1',
    modelId: 'lucidnova-rf1-100b',
    apiKey: process.env.LUCIDQUERY_API_KEY,
    headers: {
      'X-Custom-Header': 'value',
    },
  },
});
```

### 動的モデルの選択 \{#dynamic-model-selection\}

```typescript
const agent = new Agent({
  name: 'dynamic-agent',
  model: ({ runtimeContext }) => {
    const useAdvanced = runtimeContext.task === 'complex';
    return useAdvanced ? 'lucidquery/lucidquery-nexus-coder' : 'lucidquery/lucidnova-rf1-100b';
  },
});
```
