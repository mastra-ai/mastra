---
title: "ランタイムコンテキスト"
description: Mastra の RuntimeContext を使って、エージェントに動的でリクエストごとの設定を提供する方法を学びます。
sidebar_position: 3
---

# ランタイムコンテキスト \{#runtime-context\}

エージェント、ツール、ワークフローはすべて `RuntimeContext` をパラメータとして受け取り、リクエスト固有の値を基盤となるプリミティブで利用できるようにします。

## `RuntimeContext` を使うタイミング \{#when-to-use-runtimecontext\}

ランタイムの条件に応じてプリミティブの挙動を変える必要がある場合に `RuntimeContext` を使います。たとえば、ユーザー属性に基づいてモデルやストレージバックエンドを切り替えたり、言語に合わせて指示やツールの選択を調整したりします。

:::info Note
`RuntimeContext` は主に特定のリクエストにデータを渡すために用いられます。これは、複数回の呼び出しにまたがる会話履歴や状態の永続化を扱うエージェントメモリとは異なります。
:::

## 値の設定 \{#setting-values\}

`runtimeContext` をエージェント、ネットワーク、ワークフロー、またはツールの呼び出しに渡すと、実行中にすべての基礎的なプリミティブで値を利用できるようになります。呼び出しを行う前に `.set()` を使用して値を定義します。

`.set()` メソッドは 2 つの引数を取ります:

1. **key**: 値を識別するための名前。
2. **value**: そのキーに対応づけるデータ。

```typescript showLineNumbers
import { RuntimeContext } from '@mastra/core/runtime-context';

export type UserTier = {
  'user-tier': 'enterprise' | 'pro';
};

const runtimeContext = new RuntimeContext<UserTier>();
runtimeContext.set('user-tier', 'enterprise');

const agent = mastra.getAgent('weatherAgent');
await agent.generate("ロンドンの天気はどう？", {
  runtimeContext,
});

const routingAgent = mastra.getAgent('routingAgent');
routingAgent.network("ロンドンの天気はどう？", {
  runtimeContext,
});

const run = await mastra.getWorkflow('weatherWorkflow').createRunAsync();
await run.start({
  inputData: {
    location: 'ロンドン',
  },
  runtimeContext,
});
await run.resume({
  resumeData: {
    city: 'ニューヨーク',
  },
  runtimeContext,
});

await weatherTool.execute({
  context: {
    location: 'ロンドン',
  },
  runtimeContext,
});
```

### リクエストヘッダーに基づく値の設定 \{#setting-values-based-on-request-headers\}

`runtimeContext` は、リクエストから情報を抽出し、サーバーのミドルウェア内で動的に設定できます。次の例では、Cloudflare の `CF-IPCountry` ヘッダーに基づいて `temperature-unit` を設定し、レスポンスがユーザーのロケールに合致するようにしています。

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { testWeatherAgent } from './agents/test-weather-agent';

export const mastra = new Mastra({
  agents: { testWeatherAgent },
  server: {
    middleware: [
      async (context, next) => {
        const country = context.req.header('CF-IPCountry');
        const runtimeContext = context.get('runtimeContext');

        runtimeContext.set('temperature-unit', country === 'US' ? 'fahrenheit' : 'celsius');

        await next();
      },
    ],
  },
});
```

> サーバーミドルウェアの使い方は、[Middleware](/docs/server-db/middleware) を参照してください。

## エージェントで値にアクセスする \{#accessing-values-with-agents\}

エージェントの任意の対応構成オプションから `runtimeContext` 引数にアクセスできます。これらの関数は同期または `async` にできます。`runtimeContext` の値を読み取るには `.get()` メソッドを使用します。

```typescript {7-8,15,18,21} filename="src/mastra/agents/weather-agent.ts" showLineNumbers
export type UserTier = {
  'user-tier': 'enterprise' | 'pro';
};

export const weatherAgent = new Agent({
  name: 'weather-agent',
  instructions: async ({ runtimeContext }) => {
    const userTier = runtimeContext.get('user-tier') as UserTier['user-tier'];

    if (userTier === 'enterprise') {
      // ...
    }
    // ...
  },
  model: ({ runtimeContext }) => {
    // ...
  },
  tools: ({ runtimeContext }) => {
    // ...
  },
  memory: ({ runtimeContext }) => {
    // ...
  },
});
```

`runtimeContext` は、`agents`、`workflows`、`scorers`、`inputProcessors`、`outputProcessors` などの他のオプションと組み合わせて使用できます。

> 設定可能なオプションの一覧は [Agent](/docs/reference/agents/agent) を参照してください。

## ワークフローステップから値にアクセスする \{#accessing-values-from-workflow-steps\}

ワークフローステップの `execute` 関数から `runtimeContext` 引数にアクセスできます。この関数は同期・非同期いずれでも構いません。`runtimeContext` から値を読み取るには、`.get()` メソッドを使用します。

```typescript {7-8} filename="src/mastra/workflows/weather-workflow.ts" showLineNumbers copy
export type UserTier = {
  'user-tier': 'enterprise' | 'pro';
};

const stepOne = createStep({
  id: 'step-one',
  execute: async ({ runtimeContext }) => {
    const userTier = runtimeContext.get('user-tier') as UserTier['user-tier'];

    if (userTier === 'enterprise') {
      // ...
    }
    // ...
  },
});
```

> 設定オプションの一覧は [createStep()](/docs/reference/workflows/step) を参照してください。

## ツールで値にアクセスする \{#accessing-values-with-tools\}

ツールの `execute` 関数から `runtimeContext` 引数にアクセスできます。この関数は `async` です。`runtimeContext` から値を取得するには `.get()` メソッドを使用します。

```typescript {7-8} filename="src/mastra/tools/weather-tool.ts" showLineNumbers
export type UserTier = {
  'user-tier': 'enterprise' | 'pro';
};

export const weatherTool = createTool({
  id: 'weather-tool',
  execute: async ({ runtimeContext }) => {
    const userTier = runtimeContext.get('user-tier') as UserTier['user-tier'];

    if (userTier === 'enterprise') {
      // ...
    }
    // ...
  },
});
```

> 設定オプションの一覧は、[createTool()](/docs/reference/tools/create-tool) を参照してください。

## 関連項目 \{#related\}

* [エージェントのランタイムコンテキスト](/docs/agents/agent-memory#memory-with-runtimecontext)
* [ワークフローのランタイムコンテキスト](/docs/workflows/overview)
* [ツールのランタイムコンテキスト](/docs/tools-mcp/runtime-context)
* [サーバーのミドルウェア・ランタイムコンテキスト](/docs/server-db/middleware)