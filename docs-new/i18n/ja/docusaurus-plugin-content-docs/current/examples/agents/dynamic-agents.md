---
title: 動的コンテキストの例
description: Mastraでランタイムコンテキストを使って動的なエージェントを作成・構成する方法を学びます。
---

# 動的コンテキスト \{#dynamic-context\}

動的エージェントは、コンテキスト入力に基づき、実行時に振る舞いと能力を適応的に変化させます。固定の設定に頼るのではなく、ユーザーや環境、シナリオに応じて調整し、単一のエージェントでも個別化されたコンテキスト対応の応答を提供できるようにします。

## 前提条件 \{#prerequisites\}

この例では `openai` モデルを使用します。`.env` ファイルに `OPENAI_API_KEY` を追加してください。

```bash filename=".env" copy
OPENAI_API_KEY=<your-api-key>
```

## エージェントの作成 \{#creating-an-agent\}

`runtimeContext` で提供される動的な値を用いて、Mastra Cloud のテクニカルサポートを返すエージェントを作成します。

```typescript filename="src/mastra/agents/example-support-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

export const supportAgent = new Agent({
  name: 'support-agent',
  description: 'ランタイムコンテキストに基づいてMastra Cloudの技術サポートを返します',
  instructions: async ({ runtimeContext }) => {
    const userTier = runtimeContext.get('user-tier');
    const language = runtimeContext.get('language');

    return `あなたは[Mastra Cloud](https://mastra.ai/en/docs/mastra-cloud/overview)のカスタマーサポートエージェントです。
    現在のユーザーは${userTier}ティアを利用しています。

    サポートガイダンス:
    ${userTier === 'free' ? '- 基本的なヘルプを提供し、ドキュメントへリンクしてください。' : ''}
    ${userTier === 'pro' ? '- 詳細な技術サポートとベストプラクティスを提供してください。' : ''}
    ${userTier === 'enterprise' ? '- カスタマイズされたソリューションによる優先サポートを提供してください。' : ''}

    必ず${language}で応答してください。`;
  },
  model: openai('gpt-4o'),
});
```

> 設定オプションの一覧は [Agent](/docs/reference/agents/agent) を参照してください。

## エージェントの登録 \{#registering-an-agent\}

エージェントを使用するには、メインの Mastra インスタンスに登録してください。

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';

import { supportAgent } from './agents/example-support-agent';

export const mastra = new Mastra({
  // ...
  agents: { supportAgent },
});
```

## 使用例 \{#example-usage\}

`set()` で `RuntimeContext` を設定し、`getAgent()` でエージェントの参照を取得してから、`runtimeContext` を渡して `generate()` を呼び出します。

```typescript filename="src/test-support-agent.ts" showLineNumbers copy
import 'dotenv/config';

import { mastra } from './mastra';
import { RuntimeContext } from '@mastra/core/runtime-context';

type SupportRuntimeContext = {
  'user-tier': 'free' | 'pro' | 'enterprise';
  language: 'en' | 'es' | 'ja';
};

const runtimeContext = new RuntimeContext<SupportRuntimeContext>();
runtimeContext.set('user-tier', 'free');
runtimeContext.set('language', 'ja');

const agent = mastra.getAgent('supportAgent');

const response = await agent.generate('Mastra Cloudは長時間実行されるリクエストを処理できますか?', {
  runtimeContext,
});

console.log(response.text);
```

## 関連項目 \{#related\}

* [エージェントの呼び出し](./calling-agents#from-the-command-line)