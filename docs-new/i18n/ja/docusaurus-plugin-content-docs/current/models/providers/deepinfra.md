---
title: "Deep Infra"
description: "Mastra で Deep Infra のモデルを利用。利用可能なモデルは 4 件。"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# <img src="https://models.dev/logos/deepinfra.svg" alt="Deep Infra logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Deep Infra \{#deep-infra\}

Mastraのモデルルーター経由で、Deep Infraの4つのモデルにアクセスできます。認証は`DEEPINFRA_API_KEY`環境変数を使用して自動的に行われます。

詳細は[Deep Infraのドキュメント](https://deepinfra.com/models)をご覧ください。

```bash
DEEPINFRA_API_KEY=あなたのAPIキー
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは親切で役に立つアシスタントです',
  model: 'deepinfra/Qwen/Qwen3-Coder-480B-A35B-Instruct',
});

// Generate a response
const response = await agent.generate('こんにちは！');

// Stream a response
const stream = await agent.stream('物語を聞かせて');
for await (const chunk of stream) {
  console.log(chunk);
}
```

:::note OpenAI 互換性

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを使用します。プロバイダー固有の機能の一部は利用できない場合があります。詳細は [Deep Infra のドキュメント](https://deepinfra.com/models)をご確認ください。

:::

## モデル \{#models\}

<ProviderModelsTable
  models={[
{
"model": "deepinfra/moonshotai/Kimi-K2-Instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 131072,
"maxOutput": 32768,
"inputCost": 0.5,
"outputCost": 2
},
{
"model": "deepinfra/Qwen/Qwen3-Coder-480B-A35B-Instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 262144,
"maxOutput": 66536,
"inputCost": 0.4,
"outputCost": 1.6
},
{
"model": "deepinfra/Qwen/Qwen3-Coder-480B-A35B-Instruct-Turbo",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 262144,
"maxOutput": 66536,
"inputCost": 0.3,
"outputCost": 1.2
},
{
"model": "deepinfra/zai-org/GLM-4.5",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 131072,
"maxOutput": 98304,
"inputCost": 0.6,
"outputCost": 2.2
}
]}
/>

## 高度な設定 \{#advanced-configuration\}

### カスタムヘッダ \{#custom-headers\}

```typescript
const agent = new Agent({
  name: 'custom-agent',
  model: {
    url: 'https://api.deepinfra.com/v1/openai',
    modelId: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
    apiKey: process.env.DEEPINFRA_API_KEY,
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
    return useAdvanced ? 'deepinfra/zai-org/GLM-4.5' : 'deepinfra/Qwen/Qwen3-Coder-480B-A35B-Instruct';
  },
});
```

## プロバイダーの直接インストール \{#direct-provider-installation\}

このプロバイダーはスタンドアロンのパッケージとして直接インストールでき、Mastra のモデルルーター用文字列の代わりに使用できます。詳しくは[パッケージのドキュメント](https://www.npmjs.com/package/@ai-sdk/deepinfra)をご覧ください。

<Tabs groupId="package-manager">
  <TabItem value="npm" label="npm" default>
    ```bash copy
    npm install @ai-sdk/deepinfra
    ```
  </TabItem>

  <TabItem value="yarn" label="yarn">
    ```bash copy
    yarn add @ai-sdk/deepinfra
    ```
  </TabItem>

  <TabItem value="pnpm" label="pnpm">
    ```bash copy
    pnpm add @ai-sdk/deepinfra
    ```
  </TabItem>

  <TabItem value="bun" label="bun">
    ```bash copy
    bun add @ai-sdk/deepinfra
    ```
  </TabItem>
</Tabs>