---
title: "Alibaba "
description: "Mastra で Alibaba のモデルを利用する。利用可能なモデルは 1 件。"
---

# <img src="https://models.dev/logos/alibaba.svg" alt="Alibaba logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Alibaba \{#alibaba\}

Mastra のモデルルーターを通じて、Alibaba のモデルを 1 つ利用できます。認証は `DASHSCOPE_API_KEY` 環境変数により自動的に行われます。

詳しくは [Alibaba のドキュメント](https://www.alibabacloud.com/help/en/model-studio/models)をご覧ください。

```bash
DASHSCOPE_API_KEY=あなたのAPIキー
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは親切で役に立つアシスタントです',
  model: 'alibaba/qwen3-coder-plus',
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

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを使用します。プロバイダー固有の機能の一部は利用できない場合があります。詳細は [Alibaba のドキュメント](https://www.alibabacloud.com/help/en/model-studio/models)をご確認ください。

:::

## 提供モデル \{#models\}

<ProviderModelsTable
  models={[
{
"model": "alibaba/qwen3-coder-plus",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 1048576,
"maxOutput": 65536,
"inputCost": 1,
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
    url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    modelId: 'qwen3-coder-plus',
    apiKey: process.env.DASHSCOPE_API_KEY,
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
    return useAdvanced ? 'alibaba/qwen3-coder-plus' : 'alibaba/qwen3-coder-plus';
  },
});
```
