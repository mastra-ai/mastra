---
title: "Mastra クライアント"
description: "Mastra クライアント SDK のセットアップ方法と使い方を学ぶ"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Mastra クライアント SDK \{#mastra-client-sdk\}

Mastra クライアント SDK は、クライアント環境から [Mastra Server](/docs/deployment/server-deployment) とやり取りするための、シンプルで型安全なインターフェースを提供します。

## 前提条件 \{#prerequisites\}

ローカルで円滑に開発するために、以下を準備してください:

* Node.js `v18` 以上
* TypeScript `v4.7` 以上（TypeScript を使用する場合）
* ローカルの Mastra サーバーが起動していること（通常はポート `4111`）

## 使い方 \{#usage\}

Mastra Client SDK はブラウザ環境向けに設計されており、Mastra サーバーへの HTTP リクエストにはネイティブの `fetch` API を使用します。

## インストール \{#installation\}

Mastra Client SDK を使用するには、必要な依存関係をインストールしてください。

<Tabs>
  <TabItem value="npm" label="npm">
    ```bash copy
    npm install @mastra/client-js@latest
    ```
  </TabItem>

  <TabItem value="yarn" label="yarn">
    ```bash copy
    yarn add @mastra/client-js@latest
    ```
  </TabItem>

  <TabItem value="pnpm" label="pnpm">
    ```bash copy
    pnpm add @mastra/client-js@latest
    ```
  </TabItem>

  <TabItem value="bun" label="bun">
    ```bash copy
    bun add @mastra/client-js@latest
    ```
  </TabItem>
</Tabs>

### `MastraClient` を初期化する \{#initialize-the-mastraclient\}

`baseUrl` を指定して初期化すると、`MastraClient` はエージェント、ツール、ワークフローを呼び出すための型安全なインターフェースを公開します。

```typescript filename="lib/mastra-client.ts" showLineNumbers copy
import { MastraClient } from '@mastra/client-js';

export const mastraClient = new MastraClient({
  baseUrl: process.env.MASTRA_API_URL || 'http://localhost:4111',
});
```

## コア API \{#core-apis\}

Mastra Client SDK は、Mastra Server が提供するすべてのリソースにアクセスできます

* **[Agents](/docs/reference/client-js/agents)**: 応答を生成し、会話をストリーミングします。
* **[Memory](/docs/reference/client-js/memory)**: 会話スレッドとメッセージ履歴を管理します。
* **[Tools](/docs/reference/client-js/tools)**: ツールを実行・管理します。
* **[Workflows](/docs/reference/client-js/workflows)**: ワークフローを起動し、実行状況を追跡します。
* **[Vectors](/docs/reference/client-js/vectors)**: セマンティック検索のためにベクトル埋め込みを利用します。
* **[Logs](/docs/reference/client-js/logs)**: ログを確認し、システムの挙動をデバッグします。
* **[Telemetry](/docs/reference/client-js/telemetry)**: アプリのパフォーマンスを監視し、アクティビティをトレースします。

## 応答の生成 \{#generating-responses\}

`role` と `content` を含むメッセージオブジェクトの配列を渡して、`.generate()` を呼び出します：

```typescript showLineNumbers copy
import { mastraClient } from 'lib/mastra-client';

const testAgent = async () => {
  try {
    const agent = mastraClient.getAgent('testAgent');

    const response = await agent.generate({
      messages: [
        {
          role: 'user',
          content: 'こんにちは',
        },
      ],
    });

    console.log(response.text);
  } catch (error) {
    return 'レスポンスの生成中にエラーが発生しました';
  }
};
```

> 詳細は [.generate()](/docs/reference/client-js/agents#generate-response) をご覧ください。

## ストリーミングレスポンス \{#streaming-responses\}

`role` と `content` を含むメッセージオブジェクトの配列に対して、リアルタイムに応答を得るには `.stream()` を使用します：

```typescript showLineNumbers copy
import { mastraClient } from 'lib/mastra-client';

const testAgent = async () => {
  try {
    const agent = mastraClient.getAgent('testAgent');

    const stream = await agent.stream({
      messages: [
        {
          role: 'user',
          content: 'こんにちは',
        },
      ],
    });

    stream.processDataStream({
      onTextPart: text => {
        console.log(text);
      },
    });
  } catch (error) {
    return '応答の生成中にエラーが発生しました';
  }
};
```

> くわしくは[.stream()](/docs/reference/client-js/agents#stream-response)をご覧ください。

## 設定オプション \{#configuration-options\}

`MastraClient` は、リクエストの挙動を制御するために `retries`、`backoffMs`、`headers` などのオプションパラメータを受け付けます。これらのパラメータは、再試行の動作を調整したり、診断用メタデータを付与するのに役立ちます。

```typescript filename="lib/mastra-client.ts" showLineNumbers copy
import { MastraClient } from '@mastra/client-js';

export const mastraClient = new MastraClient({
  // ...
  retries: 3,
  backoffMs: 300,
  maxBackoffMs: 5000,
  headers: {
    'X-Development': 'true',
  },
});
```

> さらに詳しい設定オプションについては、[MastraClient](/docs/reference/client-js/mastra-client) を参照してください。

## リクエストのキャンセルを追加する \{#adding-request-cancelling\}

`MastraClient` は、標準の Node.js `AbortSignal` API によるリクエストのキャンセルをサポートしています。ユーザーが操作を中止した場合や、古いネットワーク呼び出しを整理したい場合など、進行中のリクエストを取り消すのに役立ちます。

すべてのリクエストでキャンセルを有効にするには、クライアントのコンストラクターに `AbortSignal` を渡します。

```typescript {3,7} filename="lib/mastra-client.ts" showLineNumbers copy
import { MastraClient } from '@mastra/client-js';

export const controller = new AbortController();

export const mastraClient = new MastraClient({
  baseUrl: process.env.MASTRA_API_URL || 'http://localhost:4111',
  abortSignal: controller.signal,
});
```

### `AbortController` の使用 \{#using-the-abortcontroller\}

`.abort()` を呼び出すと、そのシグナルに関連付けられた進行中のリクエストがキャンセルされます。

```typescript {4} showLineNumbers copy
import { mastraClient, controller } from 'lib/mastra-client';

const handleAbort = () => {
  controller.abort();
};
```

## クライアントツール \{#client-tools\}

`createTool()` 関数を使ってクライアントサイドのアプリケーション内でツールを直接定義し、`.generate()` または `.stream()` の呼び出し時に `clientTools` パラメータへ渡します。

これにより、エージェントは DOM 操作、ローカルストレージへのアクセス、その他の Web API といったブラウザー側の機能を呼び出せるようになり、サーバーではなくユーザーの環境でツールを実行できます。

```typescript {27} showLineNumbers copy
import { createTool } from '@mastra/client-js';
import { z } from 'zod';

const handleClientTool = async () => {
  try {
    const agent = mastraClient.getAgent('colorAgent');

    const colorChangeTool = createTool({
      id: 'color-change-tool',
      description: 'HTMLの背景色を変更します',
      inputSchema: z.object({
        color: z.string(),
      }),
      outputSchema: z.object({
        success: z.boolean(),
      }),
      execute: async ({ context }) => {
        const { color } = context;

        document.body.style.backgroundColor = color;
        return { success: true };
      },
    });

    const response = await agent.generate({
      messages: '背景を青に変更して',
      clientTools: { colorChangeTool },
    });

    console.log(response);
  } catch (error) {
    console.error(error);
  }
};
```

### クライアントツールのエージェント \{#client-tools-agent\}

これは、上で定義したブラウザベースのクライアントツールと連携することを想定し、16進数のカラーコードを返すように構成された標準的な Mastra の[エージェント](../agents/overview#create-an-agent)です。

```typescript filename="src/mastra/agents/color-agent" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

export const colorAgent = new Agent({
  name: 'test-agent',
  instructions: `あなたは親切なCSSアシスタントです。
  Webページの背景色を変更できます。
  ユーザーがリクエストした色を16進数カラーコードで返してください`,
  model: openai('gpt-4o-mini'),
});
```

## サーバーサイド環境 \{#server-side-environments\}

`MastraClient` は、API ルートやサーバーレス関数、アクションなどのサーバーサイド環境でも使用できます。使い方は概ね同じですが、クライアントへのレスポンスを再生成する必要が生じる場合があります。

```typescript {8} showLineNumbers
export async function action() {
  const agent = mastraClient.getAgent('testAgent');

  const stream = await agent.stream({
    messages: [{ role: 'user', content: 'Hello' }],
  });

  return new Response(stream.body);
}
```

## ベストプラクティス \{#best-practices\}

1. **エラー処理**: 開発時に適切な[エラー処理](/docs/reference/client-js/error-handling)を実装します。
2. **環境変数**: 設定には環境変数を使用します。
3. **デバッグ**: 必要に応じて詳細な[ログ](/docs/reference/client-js/logs)を有効化します。
4. **パフォーマンス**: アプリケーションのパフォーマンス、[テレメトリ](/docs/reference/client-js/telemetry)、トレースを監視します。