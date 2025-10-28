---
title: "Anthropic"
description: "Mastra で Anthropic のモデルを利用できます。利用可能なモデルは 11 件です。"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# <img src="https://models.dev/logos/anthropic.svg" alt="Anthropic logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Anthropic \{#anthropic\}

Mastraのモデルルーター経由で、Anthropicの11種類のモデルにアクセスできます。認証は `ANTHROPIC_API_KEY` 環境変数によって自動的に行われます。

詳しくは [Anthropicのドキュメント](https://docs.anthropic.com/en/docs/about-claude/models)をご覧ください。

```bash
ANTHROPIC_API_KEY=your-api-key
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: '親切で役に立つアシスタントです',
  model: 'anthropic/claude-3-5-haiku-20241022',
});

// Generate a response
const response = await agent.generate('こんにちは！');

// Stream a response
const stream = await agent.stream('物語を聞かせてください');
for await (const chunk of stream) {
  console.log(chunk);
}
```

## 対応モデル \{#models\}

<ProviderModelsTable
  models={[
{
"model": "anthropic/claude-3-5-sonnet-20241022",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 200000,
"maxOutput": 8192,
"inputCost": 3,
"outputCost": 15
},
{
"model": "anthropic/claude-3-5-sonnet-20240620",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 200000,
"maxOutput": 8192,
"inputCost": 3,
"outputCost": 15
},
{
"model": "anthropic/claude-3-opus-20240229",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 200000,
"maxOutput": 4096,
"inputCost": 15,
"outputCost": 75
},
{
"model": "anthropic/claude-sonnet-4-5-20250929",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 200000,
"maxOutput": 64000,
"inputCost": 3,
"outputCost": 15
},
{
"model": "anthropic/claude-sonnet-4-20250514",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 200000,
"maxOutput": 64000,
"inputCost": 3,
"outputCost": 15
},
{
"model": "anthropic/claude-opus-4-20250514",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 200000,
"maxOutput": 32000,
"inputCost": 15,
"outputCost": 75
},
{
"model": "anthropic/claude-3-5-haiku-20241022",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 200000,
"maxOutput": 8192,
"inputCost": 0.8,
"outputCost": 4
},
{
"model": "anthropic/claude-3-haiku-20240307",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 200000,
"maxOutput": 4096,
"inputCost": 0.25,
"outputCost": 1.25
},
{
"model": "anthropic/claude-3-7-sonnet-20250219",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 200000,
"maxOutput": 64000,
"inputCost": 3,
"outputCost": 15
},
{
"model": "anthropic/claude-opus-4-1-20250805",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 200000,
"maxOutput": 32000,
"inputCost": 15,
"outputCost": 75
},
{
"model": "anthropic/claude-3-sonnet-20240229",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 200000,
"maxOutput": 4096,
"inputCost": 3,
"outputCost": 15
}
]}
/>

## 詳細設定 \{#advanced-configuration\}

### カスタムヘッダー \{#custom-headers\}

```typescript
const agent = new Agent({
  name: 'custom-agent',
  model: {
    modelId: 'claude-3-5-haiku-20241022',
    apiKey: process.env.ANTHROPIC_API_KEY,
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
    return useAdvanced ? 'anthropic/claude-sonnet-4-5-20250929' : 'anthropic/claude-3-5-haiku-20241022';
  },
});
```

## プロバイダーの直接インストール \{#direct-provider-installation\}

このプロバイダーはスタンドアロンのパッケージとして直接インストールでき、Mastra のモデルルーター用の文字列の代わりに使用できます。詳細は[パッケージのドキュメント](https://www.npmjs.com/package/@ai-sdk/anthropic)をご覧ください。

<Tabs groupId="package-manager">
  <TabItem value="npm" label="npm" default>
    ```bash copy
    npm install @ai-sdk/anthropic
    ```
  </TabItem>

  <TabItem value="yarn" label="yarn">
    ```bash copy
    yarn add @ai-sdk/anthropic
    ```
  </TabItem>

  <TabItem value="pnpm" label="pnpm">
    ```bash copy
    pnpm add @ai-sdk/anthropic
    ```
  </TabItem>

  <TabItem value="bun" label="bun">
    ```bash copy
    bun add @ai-sdk/anthropic
    ```
  </TabItem>
</Tabs>