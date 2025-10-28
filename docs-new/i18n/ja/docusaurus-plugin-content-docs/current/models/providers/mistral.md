---
title: "Mistral "
description: "Mastra で Mistral モデルを利用できます。利用可能なモデルは 19 個です。"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# <img src="https://models.dev/logos/mistral.svg" alt="Mistral logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Mistral \{#mistral\}

Mastraのモデルルーター経由で19種類のMistralモデルにアクセスできます。認証は `MISTRAL_API_KEY` 環境変数により自動的に行われます。

詳しくは[Mistralのドキュメント](https://docs.mistral.ai/getting-started/models/)をご覧ください。

```bash
MISTRAL_API_KEY=your-api-key
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは親切なアシスタントです',
  model: 'mistral/codestral-latest',
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

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを使用します。プロバイダー固有の機能の一部は利用できない場合があります。詳細は [Mistral のドキュメント](https://docs.mistral.ai/getting-started/models/)をご確認ください。

:::

## モデル \{#models\}

<ProviderModelsTable
  models={[
{
"model": "mistral/devstral-medium-2507",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 128000,
"inputCost": 0.4,
"outputCost": 2
},
{
"model": "mistral/open-mixtral-8x22b",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 64000,
"maxOutput": 64000,
"inputCost": 2,
"outputCost": 6
},
{
"model": "mistral/ministral-8b-latest",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 128000,
"inputCost": 0.1,
"outputCost": 0.1
},
{
"model": "mistral/pixtral-large-latest",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 128000,
"inputCost": 2,
"outputCost": 6
},
{
"model": "mistral/ministral-3b-latest",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 128000,
"inputCost": 0.04,
"outputCost": 0.04
},
{
"model": "mistral/pixtral-12b",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 128000,
"inputCost": 0.15,
"outputCost": 0.15
},
{
"model": "mistral/mistral-medium-2505",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 131072,
"maxOutput": 131072,
"inputCost": 0.4,
"outputCost": 2
},
{
"model": "mistral/devstral-small-2505",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 128000,
"inputCost": 0.1,
"outputCost": 0.3
},
{
"model": "mistral/mistral-medium-2508",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 262144,
"maxOutput": 262144,
"inputCost": 0.4,
"outputCost": 2
},
{
"model": "mistral/mistral-small-latest",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 16384,
"inputCost": 0.1,
"outputCost": 0.3
},
{
"model": "mistral/magistral-small",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 128000,
"maxOutput": 128000,
"inputCost": 0.5,
"outputCost": 1.5
},
{
"model": "mistral/devstral-small-2507",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 128000,
"inputCost": 0.1,
"outputCost": 0.3
},
{
"model": "mistral/codestral-latest",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 256000,
"maxOutput": 4096,
"inputCost": 0.3,
"outputCost": 0.9
},
{
"model": "mistral/open-mixtral-8x7b",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 32000,
"maxOutput": 32000,
"inputCost": 0.7,
"outputCost": 0.7
},
{
"model": "mistral/mistral-nemo",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 128000,
"inputCost": 0.15,
"outputCost": 0.15
},
{
"model": "mistral/open-mistral-7b",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 8000,
"maxOutput": 8000,
"inputCost": 0.25,
"outputCost": 0.25
},
{
"model": "mistral/mistral-large-latest",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 131072,
"maxOutput": 16384,
"inputCost": 2,
"outputCost": 6
},
{
"model": "mistral/mistral-medium-latest",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 16384,
"inputCost": 0.4,
"outputCost": 2
},
{
"model": "mistral/magistral-medium-latest",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 128000,
"maxOutput": 16384,
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
    url: 'https://api.mistral.ai/v1',
    modelId: 'codestral-latest',
    apiKey: process.env.MISTRAL_API_KEY,
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
    return useAdvanced ? 'mistral/pixtral-large-latest' : 'mistral/codestral-latest';
  },
});
```

## プロバイダーを直接インストール \{#direct-provider-installation\}

このプロバイダーはスタンドアロンのパッケージとして直接インストールでき、Mastra のモデルルーター文字列の代わりに使用できます。詳しくは[パッケージのドキュメント](https://www.npmjs.com/package/@ai-sdk/mistral)をご覧ください。

<Tabs groupId="package-manager">
  <TabItem value="npm" label="npm" default>
    ```bash copy
    npm install @ai-sdk/mistral
    ```
  </TabItem>

  <TabItem value="yarn" label="yarn">
    ```bash copy
    yarn add @ai-sdk/mistral
    ```
  </TabItem>

  <TabItem value="pnpm" label="pnpm">
    ```bash copy
    pnpm add @ai-sdk/mistral
    ```
  </TabItem>

  <TabItem value="bun" label="bun">
    ```bash copy
    bun add @ai-sdk/mistral
    ```
  </TabItem>
</Tabs>