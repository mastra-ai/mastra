---
title: "Alibaba（中国）"
description: "MastraでAlibaba（中国）のモデルを利用できます。利用可能なモデルは1件です。"
---

# <img src="https://models.dev/logos/alibaba-cn.svg" alt="Alibaba (China) logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Alibaba (China) \{#alibaba-china\}

Mastra のモデルルーター経由で Alibaba (China) のモデルを 1 つ利用できます。認証は `DASHSCOPE_API_KEY` 環境変数によって自動的に行われます。

詳しくは [Alibaba (China) のドキュメント](https://www.alibabacloud.com/help/en/model-studio/models)をご覧ください。

```bash
DASHSCOPE_API_KEY=your-api-key
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは親切で役に立つアシスタントです',
  model: 'alibaba-cn/qwen3-coder-plus',
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

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを使用します。プロバイダー固有の機能の一部は利用できない場合があります。詳細は [Alibaba（中国）のドキュメント](https://www.alibabacloud.com/help/en/model-studio/models) をご確認ください。

:::

## モデル \{#models\}

<ProviderModelsTable
  models={[
{
"model": "alibaba-cn/qwen3-coder-plus",
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
    url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
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
    return useAdvanced ? 'alibaba-cn/qwen3-coder-plus' : 'alibaba-cn/qwen3-coder-plus';
  },
});
```
