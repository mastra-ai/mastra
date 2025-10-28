---
title: "Cerebras"
description: "Mastra で Cerebras モデルを利用できます。利用可能なモデルは3件です。"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# <img src="https://models.dev/logos/cerebras.svg" alt="Cerebras logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Cerebras \{#cerebras\}

Mastra のモデルルーター経由で 3 つの Cerebras モデルにアクセスできます。認証は `CEREBRAS_API_KEY` 環境変数により自動的に行われます。

詳しくは [Cerebras のドキュメント](https://inference-docs.cerebras.ai/models/overview)をご覧ください。

```bash
CEREBRAS_API_KEY=your-api-key
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは親切なアシスタントです',
  model: 'cerebras/gpt-oss-120b',
});

// レスポンスを生成
const response = await agent.generate('Hello!');

// レスポンスをストリーム
const stream = await agent.stream('Tell me a story');
for await (const chunk of stream) {
  console.log(chunk);
}
```

:::note OpenAI 互換性

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを使用します。プロバイダー固有の機能の一部は利用できない場合があります。詳細は [Cerebras のドキュメント](https://inference-docs.cerebras.ai/models/overview)をご確認ください。

:::

## 対応モデル \{#models\}

<ProviderModelsTable
  models={[
{
"model": "cerebras/qwen-3-235b-a22b-instruct-2507",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 131000,
"maxOutput": 32000,
"inputCost": 0.6,
"outputCost": 1.2
},
{
"model": "cerebras/qwen-3-coder-480b",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 131000,
"maxOutput": 32000,
"inputCost": 2,
"outputCost": 2
},
{
"model": "cerebras/gpt-oss-120b",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 131072,
"maxOutput": 32768,
"inputCost": 0.25,
"outputCost": 0.69
}
]}
/>

## 詳細設定 \{#advanced-configuration\}

### カスタムヘッダー \{#custom-headers\}

```typescript
const agent = new Agent({
  name: 'custom-agent',
  model: {
    url: 'https://api.cerebras.ai/v1',
    modelId: 'gpt-oss-120b',
    apiKey: process.env.CEREBRAS_API_KEY,
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
    return useAdvanced ? 'cerebras/qwen-3-coder-480b' : 'cerebras/gpt-oss-120b';
  },
});
```

## プロバイダーを直接インストール \{#direct-provider-installation\}

このプロバイダーはスタンドアロンのパッケージとして直接インストールでき、Mastra のモデルルーターの文字列の代替として使用できます。詳細は[パッケージドキュメント](https://www.npmjs.com/package/@ai-sdk/cerebras)をご覧ください。

<Tabs groupId="package-manager">
  <TabItem value="npm" label="npm" default>
    ```bash copy
    npm install @ai-sdk/cerebras
    ```
  </TabItem>

  <TabItem value="yarn" label="yarn">
    ```bash copy
    yarn add @ai-sdk/cerebras
    ```
  </TabItem>

  <TabItem value="pnpm" label="pnpm">
    ```bash copy
    pnpm add @ai-sdk/cerebras
    ```
  </TabItem>

  <TabItem value="bun" label="bun">
    ```bash copy
    bun add @ai-sdk/cerebras
    ```
  </TabItem>
</Tabs>