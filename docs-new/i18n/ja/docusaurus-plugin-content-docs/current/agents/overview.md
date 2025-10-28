---
title: "概要"
description: Mastra におけるエージェントの概要。エージェントの機能やツール、ワークフロー、外部システムとの連携方法を解説します。
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# エージェントの使用 \{#using-agents\}

エージェントは LLM とツールを活用して、オープンエンドなタスクを解決します。目標を踏まえて推論し、使用するツールを決定し、会話の記憶を保持し、モデルが最終回答を出すか任意の停止条件が満たされるまで内部で反復します。エージェントは、UI で表示したりプログラムから処理できる構造化された応答を生成します。エージェントを直接使うことも、ワークフローやエージェントネットワークに組み込むこともできます。

![エージェントの概要](/img/agents/agents-overview.jpg)

> **📹 視聴**: → エージェントの概要とワークフローとの比較 [YouTube（7分）](https://youtu.be/0jg2g3sNvgw)

## はじめに \{#getting-started\}

<Tabs>
  <TabItem value="mastra-router" label="Mastra model router">
    ### 依存関係をインストール \{#install-dependencies\}

    プロジェクトに Mastra のコアパッケージを追加します:

    ```bash
    npm install @mastra/core
    ```

    ### API キーを設定 \{#set-your-api-key\}

    Mastra のモデルルーターは、選択したプロバイダーの環境変数を自動検出します。OpenAI を使用する場合は `OPENAI_API_KEY` を設定します:

    ```bash filename=".env" copy
    OPENAI_API_KEY=<your-api-key>
    ```

    > Mastra は 600 以上のモデルに対応しています。全リストは[こちら](/docs/models)からご覧ください。

    ### エージェントを作成 \{#create-an-agent\}

    `Agent` クラスをインスタンス化し、システムの `instructions` と `model` を指定してエージェントを作成します:

    ```typescript filename="src/mastra/agents/test-agent.ts" showLineNumbers copy
    import { Agent } from '@mastra/core/agent';

    export const testAgent = new Agent({
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model: 'openai/gpt-4o-mini',
    });
    ```
  </TabItem>

  <TabItem value="vercel-ai-sdk" label="Vercel AI SDK">
    ### 依存関係をインストール \{#install-dependencies\}

    使用する Vercel AI SDK のプロバイダーとあわせて、Mastra のコアパッケージを追加します:

    ```bash
    npm install @mastra/core @ai-sdk/openai
    ```

    ### API キーを設定 \{#set-your-api-key\}

    利用するプロバイダーに対応する環境変数を設定します。AI SDK 経由で OpenAI を使用する場合:

    ```bash filename=".env" copy
    OPENAI_API_KEY=<your-api-key>
    ```

    > 追加の設定オプションは、Vercel AI SDK ドキュメントの [AI SDK Providers](https://ai-sdk.dev/providers/ai-sdk-providers) を参照してください。

    ### エージェントを作成 \{#create-an-agent\}

    Mastra でエージェントを作成するには `Agent` クラスを使用します。各エージェントには、その挙動を定義する `instructions` と、LLM のプロバイダーとモデルを指定する `model` パラメータが必須です。Vercel AI SDK を使用する場合は、クライアントをエージェントの `model` フィールドに渡します:

    ```typescript filename="src/mastra/agents/test-agent.ts" showLineNumbers copy
    import { openai } from '@ai-sdk/openai';
    import { Agent } from '@mastra/core/agent';

    export const testAgent = new Agent({
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model: openai('gpt-4o-mini'),
    });
    ```
  </TabItem>
</Tabs>

#### 指示の形式 \{#instruction-formats\}

指示はエージェントの振る舞い、人格、能力を定義します。
これは、エージェントの中核となるアイデンティティと専門性を確立するシステムレベルのプロンプトです。

柔軟性を高めるため、指示は複数の形式で提供できます。以下の例は、サポートされている形式の種類を示します。

```typescript copy
// String (most common)
instructions: 'あなたは親切なアシスタントです。';

// Array of strings
instructions: ['あなたは親切なアシスタントです。', '常に丁寧に対応してください。', '詳細な回答を提供してください。'];

// Array of system messages
instructions: [
  { role: 'system', content: 'あなたは親切なアシスタントです。' },
  { role: 'system', content: 'あなたはTypeScriptの専門知識を持っています。' },
];
```

#### プロバイダー固有のオプション \{#provider-specific-options\}

各モデルプロバイダーでは、プロンプトのキャッシュや推論の設定など、いくつかの異なるオプションも利用できます。これらを管理するためのフラグとして `providerOptions` を用意しています。システム指示やプロンプトごとに異なるキャッシュ戦略を設定するには、インストラクション単位で `providerOptions` を設定してください。

```typescript copy
// プロバイダー固有のオプション（例：キャッシュ、推論）
instructions: {
  role: "system",
  content:
    "あなたはコードレビューの専門家です。バグ、パフォーマンス上の問題、ベストプラクティスの観点からコードを分析してください。",
  providerOptions: {
    openai: { reasoning_effort: "high" },        // OpenAIの推論モデル
    anthropic: { cache_control: { type: "ephemeral" } }  // Anthropicのプロンプトキャッシュ
  }
}
```

> 詳細は、[エージェントのリファレンス](/docs/reference/agents/agent)をご覧ください。

### エージェントの登録 \{#registering-an-agent\}

エージェントを Mastra インスタンスに登録して、アプリケーション全体で利用できるようにします。登録後は、ワークフロー、ツール、ほかのエージェントから呼び出せるようになり、メモリ、ログ、可観測性といった共有リソースにもアクセスできます。

```typescript showLineNumbers filename="src/mastra/index.ts" copy
import { Mastra } from '@mastra/core/mastra';
import { testAgent } from './agents/test-agent';

export const mastra = new Mastra({
  // …
  agents: { testAgent },
});
```

## エージェントの参照 \{#referencing-an-agent\}

ワークフローのステップ、ツール、Mastra Client、またはコマンドラインからエージェントを呼び出せます。セットアップに応じて、`mastra` または `mastraClient` のインスタンスで `.getAgent()` を呼び出し、参照を取得します。

```typescript showLineNumbers copy
const testAgent = mastra.getAgent('testAgent');
```

:::tip ベストプラクティス

直接インポートするよりも `mastra.getAgent()` の使用を推奨します。登録済みのツール、テレメトリー、エージェントのメモリ用ベクターストア設定など、Mastra インスタンスの構成が保持されるためです。

:::

> 詳細は [Calling agents](/docs/examples/agents/calling-agents) をご覧ください。

## 応答の生成 \{#generating-responses\}

エージェントは結果を2通りで返せます。返す前に完全な出力を生成するか、トークンをリアルタイムにストリーミングするかです。ユースケースに合わせて選びましょう。短い内部向けの応答やデバッグには生成、エンドユーザーへできるだけ早く表示したい場合はストリーミングが適しています。

<Tabs>
  <TabItem value="generate" label="Generate">
    シンプルなプロンプトには単一の文字列を、複数のコンテキストを渡す場合は文字列配列を、あるいは `role` と `content` を持つメッセージオブジェクトの配列を渡します。

    （`role` は各メッセージの話し手を示します。一般的なロールは、人間の入力を表す `user`、エージェントの応答を表す `assistant`、指示を表す `system` です。）

    ```typescript showLineNumbers copy
    const response = await testAgent.generate([
      { role: 'user', content: 'Help me organize my day' },
      { role: 'user', content: 'My day starts at 9am and finishes at 5.30pm' },
      { role: 'user', content: 'I take lunch between 12:30 and 13:30' },
      { role: 'user', content: 'I have meetings Monday to Friday between 10:30 and 11:30' },
    ]);

    console.log(response.text);
    ```
  </TabItem>

  <TabItem value="stream" label="Stream">
    シンプルなプロンプトには単一の文字列を、複数のコンテキストを渡す場合は文字列配列を、あるいは `role` と `content` を持つメッセージオブジェクトの配列を渡します。

    （`role` は各メッセージの話し手を示します。一般的なロールは、人間の入力を表す `user`、エージェントの応答を表す `assistant`、指示を表す `system` です。）

    ```typescript showLineNumbers copy
    const stream = await testAgent.stream([
      { role: 'user', content: 'Help me organize my day' },
      { role: 'user', content: 'My day starts at 9am and finishes at 5.30pm' },
      { role: 'user', content: 'I take lunch between 12:30 and 13:30' },
      { role: 'user', content: 'I have meetings Monday to Friday between 10:30 and 11:30' },
    ]);

    for await (const chunk of stream.textStream) {
      process.stdout.write(chunk);
    }
    ```

    ### `onFinish()` を使った完了処理 \{#completion-using-onfinish\}

    ストリーミング応答では、LLM が応答の生成を終え、すべてのツール実行が完了した後に `onFinish()` コールバックが実行されます。
    最終的な `text`、実行の `steps`、`finishReason`、トークンの `usage` 統計、監視やログに役立つその他のメタデータが提供されます。

    ```typescript showLineNumbers copy
    const stream = await testAgent.stream('Help me organize my day', {
      onFinish: ({ steps, text, finishReason, usage }) => {
        console.log({ steps, text, finishReason, usage });
      },
    });

    for await (const chunk of stream.textStream) {
      process.stdout.write(chunk);
    }
    ```
  </TabItem>
</Tabs>

> 詳しくは [.generate()](/docs/reference/agents/generate) または [.stream()](/docs/reference/streaming/agents/stream) をご覧ください。

## 構造化出力 \{#structured-output\}

エージェントは、[Zod](https://zod.dev/) または [JSON Schema](https://json-schema.org/) を用いて期待する出力を定義することで、構造化された型安全なデータを返せます。TypeScript でのサポートと開発者体験の観点からは Zod を推奨します。パース済みの結果は `response.object` で利用でき、検証済みかつ型付けされたデータをそのまま扱えます。

### Zod の使用 \{#using-zod\}

[Zod](https://zod.dev/) を使って `output` のスキーマを定義します:

```typescript showLineNumbers copy
import { z } from 'zod';

const response = await testAgent.generate(
  [
    {
      role: 'system',
      content: '次のテキストの要約とキーワードを出力してください:',
    },
    {
      role: 'user',
      content: 'サル、アイスクリーム、ボート',
    },
  ],
  {
    structuredOutput: {
      schema: z.object({
        summary: z.string(),
        keywords: z.array(z.string()),
      }),
    },
    maxSteps: 1,
  },
);

console.log(response.object);
```

## 画像の扱い \{#working-with-images\}

エージェントは、画像内の視覚情報と文字情報の両方を処理して、画像を分析・説明できます。画像解析を有効にするには、`content` 配列に `type: 'image'` と画像のURLを含むオブジェクトを渡します。画像コンテンツとテキストのプロンプトを組み合わせて、エージェントの分析を誘導できます。

```typescript showLineNumbers copy
const response = await testAgent.generate([
  {
    role: 'user',
    content: [
      {
        type: 'image',
        image: 'https://placebear.com/cache/395-205.jpg',
        mimeType: 'image/jpeg',
      },
      {
        type: 'text',
        text: '画像を詳細に説明し、画像内の文字をすべて抽出してください。',
      },
    ],
  },
]);

console.log(response.text);
```

## マルチステップのツール活用 \{#multi-step-tool-use\}

エージェントは、テキスト生成の範囲を超えて能力を拡張する「ツール」によって強化できます。ツールを使うことで、エージェントは計算を実行し、外部システムにアクセスし、データを処理できます。エージェントは与えられたツールを呼び出すかどうかだけでなく、そのツールに渡すべきパラメータも自ら決定します。

ツールの作成と設定に関する詳しいガイドは、[Tools Overview](../tools-mcp/overview) ページをご覧ください。

### `maxSteps` の使用 \{#using-maxsteps\}

`maxSteps` パラメータは、エージェントが実行できる連続した LLM 呼び出しの最大回数を制御します。各ステップには、応答の生成、ツール呼び出しの実行、結果の処理が含まれます。ステップ数を制限することで、無限ループの防止、レイテンシの低減、ツールを用いるエージェントにおけるトークン使用量の抑制に役立ちます。デフォルトは 1 ですが、増やすことができます。

```typescript showLineNumbers copy
const response = await testAgent.generate('今日の予定の整理を手伝って', {
  maxSteps: 5,
});

console.log(response.text);
```

### `onStepFinish` の使用 \{#using-onstepfinish\}

`onStepFinish` コールバックを使うと、複数ステップの処理の進捗を監視できます。デバッグやユーザーへの進捗通知に役立ちます。

`onStepFinish` は、ストリーミング時または構造化されていないテキストを生成する場合にのみ利用できます。

```typescript showLineNumbers copy
const response = await testAgent.generate('今日の一日を整理するのを手伝って', {
  onStepFinish: ({ text, toolCalls, toolResults, finishReason, usage }) => {
    console.log({ text, toolCalls, toolResults, finishReason, usage });
  },
});
```

## ローカルでのエージェントのテスト \{#testing-agents-locally\}

エージェントを実行してテストする方法は2通りあります。

### Mastra Playground \{#mastra-playground\}

Mastra Dev Server が起動している場合、ブラウザで [http://localhost:4111/agents](http://localhost:4111/agents) を開くと、Mastra Playground からエージェントをテストできます。

> 詳細は、[Local Dev Playground](/docs/getting-started/local-dev-playground) のドキュメントをご覧ください。

### コマンドライン \{#command-line\}

`.generate()` または `.stream()` を使ってエージェントの応答を生成します。

```typescript {7} filename="src/test-agent.ts" showLineNumbers copy
import 'dotenv/config';

import { mastra } from './mastra';

const agent = mastra.getAgent('testAgent');

const response = await agent.generate('一日の予定の整理を手伝って');

console.log(response.text);
```

> 詳しくは [.generate()](/docs/reference/agents/generate) または [.stream()](/docs/reference/streaming/agents/stream) をご覧ください。

このエージェントをテストするには、次を実行してください:

```bash copy
npx tsx src/test-agent.ts
```

## 関連項目 \{#related\}

* [エージェントのメモリ](./agent-memory)
* [ダイナミックエージェント](/docs/examples/agents/dynamic-agents)
* [エージェントツールと MCP](./using-tools-and-mcp)
* [エージェントの呼び出し](/docs/examples/agents/calling-agents)