---
title: "OpenRouter を使う"
description: "OpenRouter を Mastra と統合する方法を学ぶ"
---

# Mastra で OpenRouter を使う \{#use-openrouter-with-mastra\}

OpenRouter 上で利用可能な多数のモデルを活用するために、Mastra と OpenRouter を連携させましょう。

## Mastra プロジェクトの初期化 \{#initialize-a-mastra-project\}

Mastra を始めるいちばん簡単な方法は、`mastra` CLI を使って新しいプロジェクトを初期化することです。

```bash copy
npx create-mastra@latest
```

プロジェクトのセットアップはプロンプトに従って進みます。この例では、次を選択してください:

* プロジェクト名: my-mastra-openrouter-app
* コンポーネント: Agents（推奨）
* 既定のプロバイダーは OpenAI（推奨）を選択 — OpenRouter は後で手動設定します
* サンプルコードをオプションで含める

## OpenRouter を設定する \{#configure-openrouter\}

`create-mastra` でプロジェクトを作成すると、プロジェクトのルートに `.env` ファイルが生成されます。
セットアップ時に OpenAI を選択したため、OpenRouter は手動で設定します。

```bash filename=".env" copy
OPENROUTER_API_KEY=
```

プロジェクトから `@ai-sdk/openai` パッケージを削除します：

```bash copy
npm uninstall @ai-sdk/openai
```

次に、`@openrouter/ai-sdk-provider` パッケージをインストールします。

```bash copy
npm install @openrouter/ai-sdk-provider
```

## Agent を OpenRouter で利用するように設定する \{#configure-your-agent-to-use-openrouter\}

これから、Agent を OpenRouter で利用できるように設定します。

```typescript filename="src/mastra/agents/assistant.ts" copy showLineNumbers {4-6,11}
import { Agent } from '@mastra/core/agent';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const assistant = new Agent({
  name: 'assistant',
  instructions: 'あなたは親切なアシスタントです。',
  model: openrouter('anthropic/claude-sonnet-4'),
});
```

Mastra のインスタンスにエージェントを必ず登録してください：

```typescript filename="src/mastra/index.ts" copy showLineNumbers {4}
import { assistant } from './agents/assistant';

export const mastra = new Mastra({
  agents: { assistant },
});
```

## エージェントを実行してテストする \{#run-and-test-your-agent\}

```bash copy
npm run dev
```

Mastra の開発サーバーが起動します。

プレイグラウンドは [http://localhost:4111](http://localhost:4111) で、または Mastra API の [http://localhost:4111/api/agents/assistant/stream](http://localhost:4111/api/agents/assistant/stream) 経由で、エージェントをテストできます。

## 高度な設定 \{#advanced-configuration\}

OpenRouter へのリクエストをより柔軟に制御するには、追加の設定オプションを指定できます。

### プロバイダー共通のオプション: \{#provider-wide-options\}

OpenRouter のプロバイダーに、プロバイダー共通のオプションを渡せます。

```typescript filename="src/mastra/agents/assistant.ts" {6-10} copy showLineNumbers
import { Agent } from '@mastra/core/agent';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  extraBody: {
    reasoning: {
      max_tokens: 10,
    },
  },
});

export const assistant = new Agent({
  name: 'assistant',
  instructions: 'あなたは親切なアシスタントです。',
  model: openrouter('anthropic/claude-sonnet-4'),
});
```

### モデル固有のオプション: \{#model-specific-options\}

OpenRouter プロバイダーにモデル固有のオプションを渡せます:

```typescript filename="src/mastra/agents/assistant.ts" {11-17} copy showLineNumbers
import { Agent } from '@mastra/core/agent';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const assistant = new Agent({
  name: 'assistant',
  instructions: 'あなたは親切なアシスタントです。',
  model: openrouter('anthropic/claude-sonnet-4', {
    extraBody: {
      reasoning: {
        max_tokens: 10,
      },
    },
  }),
});
```

### プロバイダー固有のオプション: \{#provider-specific-options\}

OpenRouter のプロバイダーに、プロバイダー固有のオプションを渡せます。

```typescript copy showLineNumbers {7-12}
// プロバイダー固有のオプションを使用してレスポンスを取得
const response = await assistant.generate([
  {
    role: 'system',
    content: 'あなたはシェフ・ミシェルです。ケトジェニック(ケト)ダイエットを専門とする料理の専門家です...',
    providerOptions: {
      // プロバイダー固有のオプション - キーは 'anthropic' または 'openrouter' を指定可能
      anthropic: {
        cacheControl: { type: 'ephemeral' },
      },
    },
  },
  {
    role: 'user',
    content: 'ケトの朝食を提案してもらえますか?',
  },
]);
```
