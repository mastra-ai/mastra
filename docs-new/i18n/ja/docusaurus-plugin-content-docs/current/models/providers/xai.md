---
title: "XAI"
description: "Mastra で xAI モデルを利用。全20モデルに対応。"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# <img src="https://models.dev/logos/xai.svg" alt="xAI logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />xAI \{#xai\}

Mastraのモデルルーター経由で、20種類のxAIモデルにアクセスできます。認証は `XAI_API_KEY` 環境変数によって自動的に行われます。

詳しくは[xAIのドキュメント](https://docs.x.ai/docs/models)をご覧ください。

```bash
XAI_API_KEY=your-api-key
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは親切なアシスタントです',
  model: 'xai/grok-2',
});

// レスポンスを生成
const response = await agent.generate('Hello!');

// レスポンスをストリーミング
const stream = await agent.stream('物語を聞かせて');
for await (const chunk of stream) {
  console.log(chunk);
}
```

## モデル \{#models\}

<ProviderModelsTable
  models={[
{
"model": "xai/grok-4-fast-non-reasoning",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 2000000,
"maxOutput": 30000,
"inputCost": 0.2,
"outputCost": 0.5
},
{
"model": "xai/grok-3-fast",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 131072,
"maxOutput": 8192,
"inputCost": 5,
"outputCost": 25
},
{
"model": "xai/grok-4",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 256000,
"maxOutput": 64000,
"inputCost": 3,
"outputCost": 15
},
{
"model": "xai/grok-2-vision",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 8192,
"maxOutput": 4096,
"inputCost": 2,
"outputCost": 10
},
{
"model": "xai/grok-code-fast-1",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 256000,
"maxOutput": 10000,
"inputCost": 0.2,
"outputCost": 1.5
},
{
"model": "xai/grok-2",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 131072,
"maxOutput": 8192,
"inputCost": 2,
"outputCost": 10
},
{
"model": "xai/grok-3-mini-fast-latest",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 131072,
"maxOutput": 8192,
"inputCost": 0.6,
"outputCost": 4
},
{
"model": "xai/grok-2-vision-1212",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 8192,
"maxOutput": 4096,
"inputCost": 2,
"outputCost": 10
},
{
"model": "xai/grok-3",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 131072,
"maxOutput": 8192,
"inputCost": 3,
"outputCost": 15
},
{
"model": "xai/grok-4-fast",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 2000000,
"maxOutput": 30000,
"inputCost": 0.2,
"outputCost": 0.5
},
{
"model": "xai/grok-2-latest",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 131072,
"maxOutput": 8192,
"inputCost": 2,
"outputCost": 10
},
{
"model": "xai/grok-2-1212",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 131072,
"maxOutput": 8192,
"inputCost": 2,
"outputCost": 10
},
{
"model": "xai/grok-3-fast-latest",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 131072,
"maxOutput": 8192,
"inputCost": 5,
"outputCost": 25
},
{
"model": "xai/grok-3-latest",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 131072,
"maxOutput": 8192,
"inputCost": 3,
"outputCost": 15
},
{
"model": "xai/grok-2-vision-latest",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 8192,
"maxOutput": 4096,
"inputCost": 2,
"outputCost": 10
},
{
"model": "xai/grok-vision-beta",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 8192,
"maxOutput": 4096,
"inputCost": 5,
"outputCost": 15
},
{
"model": "xai/grok-3-mini",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 131072,
"maxOutput": 8192,
"inputCost": 0.3,
"outputCost": 0.5
},
{
"model": "xai/grok-beta",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 131072,
"maxOutput": 4096,
"inputCost": 5,
"outputCost": 15
},
{
"model": "xai/grok-3-mini-latest",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 131072,
"maxOutput": 8192,
"inputCost": 0.3,
"outputCost": 0.5
},
{
"model": "xai/grok-3-mini-fast",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 131072,
"maxOutput": 8192,
"inputCost": 0.6,
"outputCost": 4
}
]}
/>

## 詳細設定 \{#advanced-configuration\}

### カスタムヘッダー \{#custom-headers\}

```typescript
const agent = new Agent({
  name: 'custom-agent',
  model: {
    modelId: 'grok-2',
    apiKey: process.env.XAI_API_KEY,
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
    return useAdvanced ? 'xai/grok-vision-beta' : 'xai/grok-2';
  },
});
```

## プロバイダーを直接インストール \{#direct-provider-installation\}

このプロバイダーはスタンドアロンのパッケージとして直接インストールでき、Mastra のモデルルーター文字列の代わりに使用できます。詳しくは[パッケージのドキュメント](https://www.npmjs.com/package/@ai-sdk/xai)をご覧ください。

<Tabs groupId="package-manager">
  <TabItem value="npm" label="npm" default>
    ```bash copy
    npm install @ai-sdk/xai
    ```
  </TabItem>

  <TabItem value="yarn" label="yarn">
    ```bash copy
    yarn add @ai-sdk/xai
    ```
  </TabItem>

  <TabItem value="pnpm" label="pnpm">
    ```bash copy
    pnpm add @ai-sdk/xai
    ```
  </TabItem>

  <TabItem value="bun" label="bun">
    ```bash copy
    bun add @ai-sdk/xai
    ```
  </TabItem>
</Tabs>