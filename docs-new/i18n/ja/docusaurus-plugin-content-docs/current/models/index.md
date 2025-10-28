---
title: "概要"
description: "Mastra のモデルルーターを通じて、47以上のAIプロバイダーと814以上のモデルにアクセスできます。"
sidebar_position: 1
---

import { CardGrid, CardGridItem } from '@site/src/components/CardGrid';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# モデルプロバイダー \{#model-providers\}

Mastra は、複数プロバイダーの LLM を横断して扱える統一インターフェースを提供し、単一の API で 47 のプロバイダーに属する 814 のモデルへアクセスできます。

## 機能 \{#features\}

* **どのモデルにも使える単一のAPI** - 追加のプロバイダー依存関係をインストール・管理することなく、あらゆるモデルにアクセスできます。

* **最新のAIへ即アクセス** - どのプロバイダー発でも、新しいモデルはリリース直後から利用可能。Mastraのプロバイダー非依存なインターフェースで、ベンダーロックインを回避します。

* [**モデルの組み合わせ**](#mix-and-match-models) - タスクに応じて異なるモデルを使い分けられます。たとえば、大規模コンテキストの処理にはGPT-4o-miniを使い、その後の推論タスクにはClaude Opus 4.1へ切り替えます。

* [**モデルのフォールバック**](#model-fallbacks) - プロバイダーに障害が発生した場合、Mastraはアプリケーションレベルで自動的に別プロバイダーへ切り替え、APIゲートウェイと比べてレイテンシを最小化します。

## 基本的な使い方 \{#basic-usage\}

OpenAI、Anthropic、Google、あるいは OpenRouter のようなゲートウェイを使う場合は、モデルを &quot;provider/model-name&quot; の形式で指定するだけで、あとは Mastra が処理します。

Mastra は該当する環境変数（例: `ANTHROPIC_API_KEY`）を読み取り、リクエストをプロバイダーにルーティングします。API キーが設定されていない場合は、どの変数を設定すべきかが明確に示された実行時エラーが表示されます。

<Tabs>
  <TabItem value="openai" label="OpenAI" default>
    ```typescript copy showLineNumbers
    import { Agent } from "@mastra/core";

    const agent = new Agent({
      name: "my-agent",
      instructions: "You are a helpful assistant",
      model: "openai/gpt-5"
    })
    ```
  </TabItem>

  <TabItem value="anthropic" label="Anthropic">
    ```typescript copy showLineNumbers
    import { Agent } from "@mastra/core";

    const agent = new Agent({
      name: "my-agent",
      instructions: "You are a helpful assistant",
      model: "anthropic/claude-4-5-sonnet"
    })
    ```
  </TabItem>

  <TabItem value="google" label="Google Gemini">
    ```typescript copy showLineNumbers
    import { Agent } from "@mastra/core";

    const agent = new Agent({
      name: "my-agent",
      instructions: "You are a helpful assistant",
      model: "google/gemini-2.5-flash"
    })
    ```
  </TabItem>

  <TabItem value="xai" label="xAI">
    ```typescript copy showLineNumbers
    import { Agent } from "@mastra/core";

    const agent = new Agent({
      name: "my-agent",
      instructions: "You are a helpful assistant",
      model: "xai/grok-4"
    })
    ```
  </TabItem>

  <TabItem value="openrouter" label="OpenRouter">
    ```typescript copy showLineNumbers
    import { Agent } from "@mastra/core";

    const agent = new Agent({
      name: "my-agent",
      instructions: "You are a helpful assistant",
      model: "openrouter/anthropic/claude-haiku-4-5"
    })
    ```
  </TabItem>
</Tabs>

## モデルディレクトリ \{#model-directory\}

左側のナビゲーションから利用可能なモデルの一覧を閲覧するか、下記をご覧ください。

<CardGrid>
  <CardGridItem title="Gateways" href="/docs/models/gateways">
    <div className="space-y-3">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm">
          <img src="https://models.dev/logos/openrouter.svg" alt="OpenRouter" className="w-4 h-4 object-contain dark:invert dark:brightness-0 dark:contrast-200" />

          <span>OpenRouter</span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <img src="https://models.dev/logos/fireworks-ai.svg" alt="Fireworks AI" className="w-4 h-4 object-contain dark:invert dark:brightness-0 dark:contrast-200" />

          <span>Fireworks AI</span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <img src="https://models.dev/logos/togetherai.svg" alt="Together AI" className="w-4 h-4 object-contain dark:invert dark:brightness-0 dark:contrast-200" />

          <span>Together AI</span>
        </div>
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400 mt-3">+ 他 0 件</div>
    </div>
  </CardGridItem>

  <CardGridItem title="Providers" href="/docs/models/providers">
    <div className="space-y-3">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm">
          <img src="https://models.dev/logos/openai.svg" alt="OpenAI" className="w-4 h-4 object-contain dark:invert dark:brightness-0 dark:contrast-200" />

          <span>OpenAI</span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <img src="https://models.dev/logos/anthropic.svg" alt="Anthropic" className="w-4 h-4 object-contain dark:invert dark:brightness-0 dark:contrast-200" />

          <span>Anthropic</span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <img src="https://models.dev/logos/google.svg" alt="Google" className="w-4 h-4 object-contain dark:invert dark:brightness-0 dark:contrast-200" />

          <span>Google</span>
        </div>
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400 mt-3">+ 他 41 件</div>
    </div>
  </CardGridItem>
</CardGrid>

エディタ内から直接モデルを見つけることもできます。Mastra は `model` フィールドに対して完全なオートコンプリートを提供します。入力を始めるだけで、IDE が利用可能なオプションを表示します。

または、[Playground](/docs/getting-started/local-dev-playground) の UI でモデルを参照・テストできます。

:::note 開発時の動作
開発環境では、最新のモデルが反映されるようにローカルのモデル一覧を毎時自動更新し、TypeScript のオートコンプリートと Playground を常に最新に保ちます。無効化するには `MASTRA_AUTO_REFRESH_PROVIDERS=false` を設定してください。本番環境では自動更新はデフォルトで無効です。
:::

## モデルを組み合わせて使う \{#mix-and-match-models\}

高速だが能力は控えめなモデルもあれば、より大きなコンテキストウィンドウや優れた推論力を備えたモデルもあります。タスクに応じて同一プロバイダー内でモデルを使い分けたり、複数のプロバイダーを組み合わせて最適化しましょう。

```typescript showLineNumbers
import { Agent } from '@mastra/core';

// ドキュメント処理にはコスト効率の良いモデルを使用
const documentProcessor = new Agent({
  name: 'document-processor',
  instructions: 'ドキュメントから重要な情報を抽出して要約',
  model: 'openai/gpt-4o-mini',
});

// 複雑な分析には強力な推論モデルを使用
const reasoningAgent = new Agent({
  name: 'reasoning-agent',
  instructions: 'データを分析し、戦略的な推奨事項を提供',
  model: 'anthropic/claude-opus-4-1',
});
```

## 動的なモデル選択 \{#dynamic-model-selection\}

モデルは単なる文字列なので、[ランタイム コンテキスト](/docs/server-db/runtime-context)や変数など、実行時の状況や任意のロジックに基づいて動的に選択できます。

```typescript showLineNumbers
const agent = new Agent({
  name: 'dynamic-assistant',
  model: ({ runtimeContext }) => {
    const provider = runtimeContext.get('provider-id');
    const model = runtimeContext.get('model-id');
    return `${provider}/${model}`;
  },
});
```

これにより、強力な活用パターンが可能になります:

* A/Bテスト - 本番環境でモデルの性能を比較する。
* ユーザー選択可能なモデル - アプリ内でユーザーが好みのモデルを選べるようにする。
* マルチテナントアプリケーション - 各顧客が自身のAPIキーとモデルの設定を持ち込めるようにする。

## プロバイダー固有のオプション \{#provider-specific-options\}

各モデルプロバイダーは、それぞれ固有の設定オプションを提供しています。OpenAI では `reasoningEffort` を調整でき、Anthropic では `cacheControl` をチューニングできます。Mastra では、これらの特定の `providerOptions` をエージェント単位またはメッセージ単位で設定できます。

```typescript showLineNumbers
// エージェントレベル（以降のすべてのメッセージに適用）
const planner = new Agent({
  instructions: {
    role: 'system',
    content: 'あなたは親切で役に立つアシスタントです。',
    providerOptions: {
      openai: { reasoningEffort: 'low' },
    },
  },
  model: 'openai/o3-pro',
});

const lowEffort = await planner.generate('簡単な3品のディナーメニューを考えて'),

// メッセージレベル（このメッセージにのみ適用）
const highEffort = await planner.generate([
  {
    role: 'user',
    content: 'セリアック病の人向けに、簡単な3品のディナーメニューを考えて',
    providerOptions: {
      openai: { reasoningEffort: 'high' },
    },
  },
]);
```

## カスタムヘッダー \{#custom-headers\}

組織IDやその他のプロバイダー固有のフィールドなど、カスタムヘッダーを指定する必要がある場合は、この構文を使用します。

```typescript showLineNumbers
const agent = new Agent({
  name: 'custom-agent',
  model: {
    id: 'openai/gpt-4-turbo',
    apiKey: process.env.OPENAI_API_KEY,
    headers: {
      'OpenAI-Organization': 'org-abc123',
    },
  },
});
```

:::note
設定はプロバイダーによって異なります。カスタムヘッダーの詳細は、左側のナビゲーションにある各プロバイダーのページをご覧ください。
:::

## モデルのフォールバック \{#model-fallbacks\}

単一のモデルに依存すると、アプリケーションに単一障害点が生じます。モデルのフォールバックは、モデルやプロバイダー間での自動フェイルオーバーを実現します。プライマリモデルが利用できなくなった場合、いずれかが成功するまで、設定された次のフォールバックに対してリクエストを再試行します。

```typescript showLineNumbers
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'resilient-assistant',
  instructions: 'あなたは親切で頼りになるアシスタントです。',
  model: [
    {
      model: 'openai/gpt-5',
      maxRetries: 3,
    },
    {
      model: 'anthropic/claude-4-5-sonnet',
      maxRetries: 2,
    },
    {
      model: 'google/gemini-2.5-pro',
      maxRetries: 2,
    },
  ],
});
```

Mastraはまずプライマリモデルを試します。500エラー、レート制限、またはタイムアウトが発生した場合は、自動的に最初のフォールバックに切り替わります。そこでも失敗した場合は、次のフォールバックへ進みます。各モデルには、次へ進む前に適用される独自のリトライ回数が設定されています。

ユーザーが中断を感じることはありません。応答は同じ形式のまま返ってきますが、別のモデルから生成されます。システムがフォールバックチェーンを辿る間、エラーのコンテキストは保持され、ストリーミング互換性を維持しつつ、クリーンなエラー伝播を実現します。

## Mastra で AI SDK を使う \{#use-ai-sdk-with-mastra\}

Mastra は AI SDK のプロバイダー用モジュールをサポートしており、必要に応じてそれらを直接利用できます。

```typescript showLineNumbers
import { groq } from '@ai-sdk/groq';
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  name: 'my-agent',
});
```

AI SDK のモデル（例: `groq('gemma2-9b-it')`）は、`"provider/model"` という文字列を受け付けるあらゆる場所で使用できます。これは、モデルルーターのフォールバックや [scorers](/docs/scorers/overview) 内も含まれます。
