---
title: "Perplexity"
description: "Mastra で Perplexity モデルを利用できます。利用可能なモデルは 4 つあります。"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# <img src="https://models.dev/logos/perplexity.svg" alt="Perplexity logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Perplexity \{#perplexity\}

Mastra のモデルルーターを通じて、4 つの Perplexity モデルにアクセスできます。認証は `PERPLEXITY_API_KEY` 環境変数を使用して自動的に行われます。

詳しくは [Perplexity のドキュメント](https://docs.perplexity.ai)をご覧ください。

```bash
PERPLEXITY_API_KEY=あなたのAPIキー
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'あなたは親切なアシスタントです',
  model: 'perplexity/sonar',
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

Mastra は OpenAI 互換の `/chat/completions` エンドポイントを使用しています。プロバイダー固有の機能の一部は利用できない場合があります。詳細は [Perplexity のドキュメント](https://docs.perplexity.ai) をご確認ください。

:::

## モデル \{#models\}

<ProviderModelsTable
  models={[
{
"model": "perplexity/sonar-reasoning",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": false,
"reasoning": true,
"contextWindow": 128000,
"maxOutput": 4096,
"inputCost": 1,
"outputCost": 5
},
{
"model": "perplexity/sonar",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": false,
"reasoning": false,
"contextWindow": 128000,
"maxOutput": 4096,
"inputCost": 1,
"outputCost": 1
},
{
"model": "perplexity/sonar-pro",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": false,
"reasoning": false,
"contextWindow": 200000,
"maxOutput": 8192,
"inputCost": 3,
"outputCost": 15
},
{
"model": "perplexity/sonar-reasoning-pro",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": false,
"reasoning": true,
"contextWindow": 128000,
"maxOutput": 4096,
"inputCost": 2,
"outputCost": 8
}
]}
/>

## 詳細設定 \{#advanced-configuration\}

### カスタムヘッダー \{#custom-headers\}

```typescript
const agent = new Agent({
  name: 'custom-agent',
  model: {
    url: 'https://api.perplexity.ai',
    modelId: 'sonar',
    apiKey: process.env.PERPLEXITY_API_KEY,
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
    return useAdvanced ? 'perplexity/sonar-reasoning-pro' : 'perplexity/sonar';
  },
});
```

## プロバイダーを直接インストール \{#direct-provider-installation\}

このプロバイダーはスタンドアロンのパッケージとして直接インストールでき、Mastra のモデルルーター用文字列の代わりに利用できます。詳しくは[パッケージのドキュメント](https://www.npmjs.com/package/@perplexity-ai/sdk)をご覧ください。

<Tabs>
  <TabItem value="npm" label="npm">
    ```bash copy
    npm install @perplexity-ai/sdk
    ```
  </TabItem>

  <TabItem value="yarn" label="yarn">
    ```bash copy
    yarn add @perplexity-ai/sdk
    ```
  </TabItem>

  <TabItem value="pnpm" label="pnpm">
    ```bash copy
    pnpm add @perplexity-ai/sdk
    ```
  </TabItem>

  <TabItem value="bun" label="bun">
    ```bash copy
    bun add @perplexity-ai/sdk
    ```
  </TabItem>
</Tabs>