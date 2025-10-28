---
title: "Google"
description: "Mastra で Google のモデルを利用できます。利用可能なモデルは 18 種類あります。"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# <img src="https://models.dev/logos/google.svg" alt="Google logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Google \{#google\}

Mastra のモデルルーター経由で 18 個の Google モデルにアクセスできます。認証は `GOOGLE_GENERATIVE_AI_API_KEY` 環境変数により自動的に処理されます。

詳しくは [Google のドキュメント](https://ai.google.dev/gemini-api/docs/pricing)をご覧ください。

```bash
GOOGLE_GENERATIVE_AI_API_KEY=your-api-key
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは親切なアシスタントです',
  model: 'google/gemini-1.5-flash',
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
"model": "google/gemini-2.5-flash-preview-05-20",
"imageInput": true,
"audioInput": true,
"videoInput": true,
"toolUsage": true,
"reasoning": true,
"contextWindow": 1048576,
"maxOutput": 65536,
"inputCost": 0.15,
"outputCost": 0.6
},
{
"model": "google/gemini-flash-lite-latest",
"imageInput": true,
"audioInput": true,
"videoInput": true,
"toolUsage": true,
"reasoning": true,
"contextWindow": 1048576,
"maxOutput": 65536,
"inputCost": 0.1,
"outputCost": 0.4
},
{
"model": "google/gemini-2.5-flash",
"imageInput": true,
"audioInput": true,
"videoInput": true,
"toolUsage": true,
"reasoning": true,
"contextWindow": 1048576,
"maxOutput": 65536,
"inputCost": 0.3,
"outputCost": 2.5
},
{
"model": "google/gemini-flash-latest",
"imageInput": true,
"audioInput": true,
"videoInput": true,
"toolUsage": true,
"reasoning": true,
"contextWindow": 1048576,
"maxOutput": 65536,
"inputCost": 0.15,
"outputCost": 0.6
},
{
"model": "google/gemini-2.5-pro-preview-05-06",
"imageInput": true,
"audioInput": true,
"videoInput": true,
"toolUsage": true,
"reasoning": true,
"contextWindow": 1048576,
"maxOutput": 65536,
"inputCost": 1.25,
"outputCost": 10
},
{
"model": "google/gemini-2.0-flash-lite",
"imageInput": true,
"audioInput": true,
"videoInput": true,
"toolUsage": true,
"reasoning": false,
"contextWindow": 1048576,
"maxOutput": 8192,
"inputCost": 0.075,
"outputCost": 0.3
},
{
"model": "google/gemini-live-2.5-flash-preview-native-audio",
"imageInput": false,
"audioInput": true,
"videoInput": true,
"toolUsage": true,
"reasoning": true,
"contextWindow": 131072,
"maxOutput": 65536,
"inputCost": 0.5,
"outputCost": 2
},
{
"model": "google/gemini-2.0-flash",
"imageInput": true,
"audioInput": true,
"videoInput": true,
"toolUsage": true,
"reasoning": false,
"contextWindow": 1048576,
"maxOutput": 8192,
"inputCost": 0.1,
"outputCost": 0.4
},
{
"model": "google/gemini-2.5-flash-lite",
"imageInput": true,
"audioInput": true,
"videoInput": true,
"toolUsage": true,
"reasoning": true,
"contextWindow": 1048576,
"maxOutput": 65536,
"inputCost": 0.1,
"outputCost": 0.4
},
{
"model": "google/gemini-2.5-pro-preview-06-05",
"imageInput": true,
"audioInput": true,
"videoInput": true,
"toolUsage": true,
"reasoning": true,
"contextWindow": 1048576,
"maxOutput": 65536,
"inputCost": 1.25,
"outputCost": 10
},
{
"model": "google/gemini-2.5-flash-lite-preview-06-17",
"imageInput": true,
"audioInput": true,
"videoInput": true,
"toolUsage": true,
"reasoning": true,
"contextWindow": 1048576,
"maxOutput": 65536,
"inputCost": 0.1,
"outputCost": 0.4
},
{
"model": "google/gemini-2.5-flash-preview-09-2025",
"imageInput": true,
"audioInput": true,
"videoInput": true,
"toolUsage": true,
"reasoning": true,
"contextWindow": 1048576,
"maxOutput": 65536,
"inputCost": 0.15,
"outputCost": 0.6
},
{
"model": "google/gemini-2.5-flash-preview-04-17",
"imageInput": true,
"audioInput": true,
"videoInput": true,
"toolUsage": true,
"reasoning": true,
"contextWindow": 1048576,
"maxOutput": 65536,
"inputCost": 0.15,
"outputCost": 0.6
},
{
"model": "google/gemini-2.5-pro",
"imageInput": true,
"audioInput": true,
"videoInput": true,
"toolUsage": true,
"reasoning": true,
"contextWindow": 1048576,
"maxOutput": 65536,
"inputCost": 1.25,
"outputCost": 10
},
{
"model": "google/gemini-1.5-flash",
"imageInput": true,
"audioInput": true,
"videoInput": true,
"toolUsage": true,
"reasoning": false,
"contextWindow": 1000000,
"maxOutput": 8192,
"inputCost": 0.075,
"outputCost": 0.3
},
{
"model": "google/gemini-1.5-flash-8b",
"imageInput": true,
"audioInput": true,
"videoInput": true,
"toolUsage": true,
"reasoning": false,
"contextWindow": 1000000,
"maxOutput": 8192,
"inputCost": 0.0375,
"outputCost": 0.15
},
{
"model": "google/gemini-2.5-flash-lite-preview-09-2025",
"imageInput": true,
"audioInput": true,
"videoInput": true,
"toolUsage": true,
"reasoning": true,
"contextWindow": 1048576,
"maxOutput": 65536,
"inputCost": 0.1,
"outputCost": 0.4
},
{
"model": "google/gemini-1.5-pro",
"imageInput": true,
"audioInput": true,
"videoInput": true,
"toolUsage": true,
"reasoning": false,
"contextWindow": 1000000,
"maxOutput": 8192,
"inputCost": 1.25,
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
    modelId: 'gemini-1.5-flash',
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
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
    return useAdvanced ? 'google/gemini-live-2.5-flash-preview-native-audio' : 'google/gemini-1.5-flash';
  },
});
```

## プロバイダーの直接インストール \{#direct-provider-installation\}

このプロバイダーはスタンドアロンのパッケージとして直接インストールでき、Mastra のモデルルーター文字列の代わりに使用できます。詳細は[パッケージのドキュメント](https://www.npmjs.com/package/@ai-sdk/google)をご覧ください。

<Tabs groupId="package-manager">
  <TabItem value="npm" label="npm" default>
    ```bash copy
    npm install @ai-sdk/google
    ```
  </TabItem>

  <TabItem value="yarn" label="yarn">
    ```bash copy
    yarn add @ai-sdk/google
    ```
  </TabItem>

  <TabItem value="pnpm" label="pnpm">
    ```bash copy
    pnpm add @ai-sdk/google
    ```
  </TabItem>

  <TabItem value="bun" label="bun">
    ```bash copy
    bun add @ai-sdk/google
    ```
  </TabItem>
</Tabs>