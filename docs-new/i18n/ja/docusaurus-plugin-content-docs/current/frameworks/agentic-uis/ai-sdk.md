---
title: "Vercel AI SDK とともに"
description: "Mastra が Vercel AI SDK ライブラリをどのように活用しているか、また Mastra を使ってさらにどのように活用できるかを学びましょう"
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Vercel AI SDK の利用 \{#using-vercel-ai-sdk\}

Mastra は [Vercel の AI SDK](https://sdk.vercel.ai) と統合しており、モデルのルーティング、React Hooks、データストリーミング手法をサポートします。

## AI SDK v5 \{#ai-sdk-v5\}

Mastra は AI SDK v5 にも対応しています。v5 固有のメソッドについては次のセクションをご覧ください: [Vercel AI SDK v5](/docs/frameworks/agentic-uis/ai-sdk#vercel-ai-sdk-v5)

:::warning

このページに掲載されているコード例は、プロジェクトのルートで Next.js の App Router を使用していることを前提としています。例: `src/app` ではなく `app`。

:::

## モデルのルーティング \{#model-routing\}

Mastraでエージェントを作成する際は、AI SDKでサポートされている任意のモデルを指定できます。

```typescript {7} filename="agents/weather-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

export const weatherAgent = new Agent({
  name: 'Weather Agent',
  instructions: 'エージェントへの指示...',
  model: openai('gpt-4-turbo'),
});
```

> 詳細は、[Model Providers](/docs/models/providers) と [Model Capabilities](/docs/models) をご覧ください。

## React Hooks \{#react-hooks\}

Mastra は、HTTP ストリーミングを通じてフロントエンドのコンポーネントをエージェントに直接接続できる AI SDK のフックをサポートしています。

必要な AI SDK の React パッケージをインストールします:

<Tabs>
  <TabItem value="install" label="install">
    ```bash copy
    npm install @ai-sdk/react
    ```
  </TabItem>

  <TabItem value="tab-2" label="Tab 2">
    ```bash copy
    yarn add @ai-sdk/react
    ```
  </TabItem>

  <TabItem value="tab-3" label="Tab 3">
    ```bash copy
    pnpm add @ai-sdk/react
    ```
  </TabItem>

  <TabItem value="tab-4" label="Tab 4">
    ```bash copy
    bun add @ai-sdk/react
    ```
  </TabItem>
</Tabs>

### `useChat()` フックの使用 \{#using-the-usechat-hook\}

`useChat` フックは、フロントエンドと Mastra エージェント間のリアルタイムなチャットやり取りを扱い、HTTP 経由でプロンプトを送信し、ストリーミングで応答を受け取れるようにします。

```typescript {6} filename="app/test/chat.tsx" showLineNumbers copy
"use client";

import { useChat } from "@ai-sdk/react";

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: "/api/chat"
  });
  return (
    <div>
      <pre>{JSON.stringify(messages, null, 2)}</pre>
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} placeholder="都市名" />
      </form>
    </div>
  );
}
```

`useChat` フックで送信されたリクエストは、標準的なサーバールートで処理されます。次の例では、Next.js の Route Handler を使って POST ルートを定義する方法を示します。

```typescript filename="app/api/chat/route.ts" showLineNumbers copy
import { mastra } from '../../mastra';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const myAgent = mastra.getAgent('weatherAgent');
  const stream = await myAgent.stream(messages);

  return stream.toDataStreamResponse();
}
```

> `useChat` をエージェントのメモリ機能と併用する場合は、重要な実装のポイントについては [Agent Memory セクション](/docs/agents/agent-memory) を参照してください。

### `useCompletion()` フックの使用 \{#using-the-usecompletion-hook\}

`useCompletion` フックは、フロントエンドと Mastra エージェント間の単発のコンpletionを扱い、プロンプトを送信して、HTTP 経由でストリーミングレスポンスを受け取れるようにします。

```typescript {6} filename="app/test/completion.tsx" showLineNumbers copy
"use client";

import { useCompletion } from "@ai-sdk/react";

export function Completion() {
  const { completion, input, handleInputChange, handleSubmit } = useCompletion({
    api: "api/completion"
  });

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} placeholder="都市名" />
      </form>
      <p>入力補完結果: {completion}</p>
    </div>
  );
}
```

`useCompletion` フックで送信されたリクエストは、標準的なサーバールートで処理されます。次の例では、Next.js の Route Handler を使って POST ルートを定義する方法を示します。

```typescript filename="app/api/completion/route.ts" showLineNumbers copy
import { mastra } from '../../../mastra';

export async function POST(req: Request) {
  const { prompt } = await req.json();
  const myAgent = mastra.getAgent('weatherAgent');
  const stream = await myAgent.stream([{ role: 'user', content: prompt }]);

  return stream.toDataStreamResponse();
}
```

### `useObject()` フックの使用 \{#using-the-useobject-hook\}

`useObject` フックは、Mastra エージェントからストリーミングされるテキストを取り込み、定義したスキーマに基づいて構造化された JSON オブジェクトにパースします。

```typescript {7} filename="app/test/object.tsx" showLineNumbers copy
"use client";

import { experimental_useObject as useObject } from "@ai-sdk/react";
import { z } from "zod";

export function Object() {
  const { object, submit } = useObject({
    api: "api/object",
    schema: z.object({
      weather: z.string()
    })
  });

  return (
    <div>
      <button onClick={() => submit("London")}>生成</button>
      {object ? <pre>{JSON.stringify(object, null, 2)}</pre> : null}
    </div>
  );
}
```

`useObject` フックで送信されたリクエストは、標準のサーバールートで処理されます。次の例では、Next.js の Route Handler を用いて POST ルートを定義する方法を示します。

```typescript filename="app/api/object/route.ts" showLineNumbers copy
import { mastra } from '../../../mastra';
import { z } from 'zod';

export async function POST(req: Request) {
  const body = await req.json();
  const myAgent = mastra.getAgent('weatherAgent');
  const stream = await myAgent.stream(body, {
    structuredOutput: {
      schema: z.object({
        weather: z.string(),
      }),
    },
    maxSteps: 1,
  });

  return stream.toTextStreamResponse();
}
```

### `sendExtraMessageFields` で追加データを渡す \{#passing-additional-data-with-sendextramessagefields\}

`sendExtraMessageFields` オプションを使うと、フロントエンドから Mastra に追加データを渡せます。このデータはサーバー側で `RuntimeContext` として利用できます。

```typescript {8,14-20} filename="app/test/chat-extra.tsx" showLineNumbers copy
"use client";

import { useChat } from "@ai-sdk/react";

export function ChatExtra() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: "/api/chat-extra",
    sendExtraMessageFields: true
  });

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(e, {
      data: {
        userId: "user123",
        preferences: {
          language: "en",
          temperature: "celsius"
        }
      }
    });
  };

  return (
    <div>
      <pre>{JSON.stringify(messages, null, 2)}</pre>
      <form onSubmit={handleFormSubmit}>
        <input value={input} onChange={handleInputChange} placeholder="都市名" />
      </form>
    </div>
  );
}
```

`sendExtraMessageFields` を使用して送信されたリクエストは、標準のサーバールートで処理されます。次の例では、カスタムデータを取り出して `RuntimeContext` インスタンスに設定する方法を示します。

```typescript {8,12} filename="app/api/chat-extra/route.ts" showLineNumbers copy
import { mastra } from '../../../mastra';
import { RuntimeContext } from '@mastra/core/runtime-context';

export async function POST(req: Request) {
  const { messages, data } = await req.json();
  const myAgent = mastra.getAgent('weatherAgent');

  const runtimeContext = new RuntimeContext();

  if (data) {
    for (const [key, value] of Object.entries(data)) {
      runtimeContext.set(key, value);
    }
  }

  const stream = await myAgent.stream(messages, { runtimeContext });
  return stream.toDataStreamResponse();
}
```

### `server.middleware` における `runtimeContext` の取り扱い \{#handling-runtimecontext-with-servermiddleware\}

サーバーのミドルウェアでカスタムデータを読み取り、`RuntimeContext` を埋め込む（初期化する）こともできます。

```typescript {6} filename="mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';

export const mastra = new Mastra({
  agents: { weatherAgent },
  server: {
    middleware: [
      async (c, next) => {
        const runtimeContext = c.get('runtimeContext');

        if (c.req.method === 'POST') {
          try {
            const clonedReq = c.req.raw.clone();
            const body = await clonedReq.json();

            if (body?.data) {
              for (const [key, value] of Object.entries(body.data)) {
                runtimeContext.set(key, value);
              }
            }
          } catch {}
        }
        await next();
      },
    ],
  },
});
```

> その後、ツールで `runtimeContext` パラメータを通じてこのデータにアクセスできます。詳細は[Agent Runtime Context のドキュメント](/docs/server-db/runtime-context)をご覧ください。

## ストリーミングデータ \{#streaming-data\}

`ai` パッケージは、カスタムデータストリームを管理するためのユーティリティを提供します。場合によっては、エージェントの `dataStream` を使って、構造化された更新情報や注釈をクライアントへ送信したいことがあります。

必要なパッケージをインストールします:

<Tabs>
  <TabItem value="install" label="install">
    ```bash copy
    npm install ai
    ```
  </TabItem>

  <TabItem value="tab-2" label="Tab 2">
    ```bash copy
    yarn add ai
    ```
  </TabItem>

  <TabItem value="tab-3" label="Tab 3">
    ```bash copy
    pnpm add ai
    ```
  </TabItem>

  <TabItem value="tab-4" label="Tab 4">
    ```bash copy
    bun add ai
    ```
  </TabItem>
</Tabs>

### `createDataStream()` を使う \{#using-createdatastream\}

`createDataStream` 関数を使うと、追加のデータをクライアントにストリーミングできます。

```typescript {1, 6} filename="mastra/agents/weather-agent.ts" showLineNumbers copy
import { createDataStream } from "ai";
import { Agent } from "@mastra/core/agent";

export const weatherAgent = new Agent({...});

createDataStream({
  async execute(dataStream) {
    dataStream.writeData({ value: "こんにちは" });

    dataStream.writeMessageAnnotation({ type: "status", value: "処理中" });

    const agentStream = await weatherAgent.stream("天気を教えて");

    agentStream.mergeIntoDataStream(dataStream);
  },
  onError: (error) => `カスタムエラー: ${error}`
});
```

### `createDataStreamResponse()` の使用 \{#using-createdatastreamresponse\}

`createDataStreamResponse` 関数は、クライアントへデータをストリーム配信するレスポンスオブジェクトを生成します。

```typescript {2,9} filename="app/api/chat-stream/route.ts" showLineNumbers copy
import { mastra } from '../../../mastra';
import { createDataStreamResponse } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const myAgent = mastra.getAgent('weatherAgent');
  const agentStream = await myAgent.stream(messages);

  const response = createDataStreamResponse({
    status: 200,
    statusText: 'OK',
    headers: {
      'Custom-Header': 'value',
    },
    async execute(dataStream) {
      dataStream.writeData({ value: 'こんにちは' });

      dataStream.writeMessageAnnotation({
        type: 'status',
        value: '処理中',
      });

      agentStream.mergeIntoDataStream(dataStream);
    },
    onError: error => `カスタムエラー: ${error}`,
  });

  return response;
}
```

## Vercel AI SDK v5 \{#vercel-ai-sdk-v5\}

このガイドでは、AI SDK v4 から v5 への移行に際しての Mastra 固有の考慮事項を解説します。

> フィードバックやバグ報告は、[GitHub の AI SDK v5 メガイシュー](https://github.com/mastra-ai/mastra/issues/5470)にお寄せください。

### ストリーム対応 \{#stream-support\}

Mastra の実験的な `stream` メソッドは、`format` パラメータにより AI SDK v5 をネイティブにサポートするようになりました。これにより、互換用ラッパーを使うことなく、AI SDK v5 のストリーミングインターフェースとシームレスに統合できます。

```typescript
// AI SDK v5形式でストリームを使用
const stream = await agent.stream(messages, {
  format: 'aisdk', // AI SDK v5互換性を有効化
});

// ストリームはAI SDK v5インターフェースと互換性があります
return stream.toUIMessageStreamResponse();
```

### 公式移行ガイド \{#official-migration-guide\}

AI SDK のコアにおける破壊的変更、パッケージの更新、API の変更については、公式の [AI SDK v5 Migration Guide](https://v5.ai-sdk.dev/docs/migration-guides/migration-guide-5-0) に従ってください。

本ガイドでは、移行に関する Mastra 固有の事項のみを扱います。

* **データ互換性**: v5 形式で保存された新規データは、v5 から v4 へダウングレードすると使用できません
* **バックアップ推奨**: v5 へアップグレードする前の DB バックアップを保持してください

### メモリとストレージ \{#memory-and-storage\}

Mastra は内部の `MessageList` クラスを使用して AI SDK v4 のデータを自動的に処理し、フォーマット変換（v4 から v5 への変換を含む）を管理します。データベースの移行は不要で、既存のメッセージはその場で変換され、アップグレード後も引き続き動作します。

### メッセージ形式の変換 \{#message-format-conversion\}

AI SDK と Mastra の形式間でメッセージを手動で変換する必要がある場合は、`convertMessages` ユーティリティをご利用ください。

```typescript
import { convertMessages } from '@mastra/core/agent';

// AI SDK v4 メッセージを v5 に変換
const aiv5Messages = convertMessages(aiv4Messages).to('AIV5.UI');

// Mastra メッセージを AI SDK v5 に変換
const aiv5Messages = convertMessages(mastraMessages).to('AIV5.Core');

// サポートされている出力形式:
// 'Mastra.V2', 'AIV4.UI', 'AIV5.UI', 'AIV5.Core', 'AIV5.Model'
```

このユーティリティは、ストレージDBからメッセージを直接取得し、AI SDKで利用できる形式に変換する際に便利です。

### ストリーミング互換性を有効化する \{#enabling-stream-compatibility\}

AI SDK v5 の互換性を有効にするには、`@mastra/ai-sdk` パッケージを使用します：

<Tabs>
  <TabItem value="install" label="install">
    ```bash copy
    npm install @mastra/ai-sdk
    ```
  </TabItem>

  <TabItem value="tab-2" label="Tab 2">
    ```bash copy
    yarn add @mastra/ai-sdk
    ```
  </TabItem>

  <TabItem value="tab-3" label="Tab 3">
    ```bash copy
    pnpm add @mastra/ai-sdk
    ```
  </TabItem>

  <TabItem value="tab-4" label="Tab 4">
    ```bash copy
    bun add @mastra/ai-sdk
    ```
  </TabItem>
</Tabs>

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { chatRoute } from '@mastra/ai-sdk';

export const mastra = new Mastra({
  server: {
    apiRoutes: [
      chatRoute({
        path: '/chat',
        agent: 'weatherAgent',
      }),
    ],
  },
});
```

アプリケーション内で `useChat()` フックを呼び出します。

```typescript
const { error, status, sendMessage, messages, regenerate, stop } = useChat({
  transport: new DefaultChatTransport({
    api: 'http://localhost:4111/chat',
  }),
});
```

### ツールの型推論 \{#type-inference-for-tools\}

AI SDK v5 で TypeScript を用いてツールを使う場合、Mastra はツールの入出力の型安全性を担保するための型推論用ヘルパーを提供します。

#### InferUITool \{#inferuitool\}

`InferUITool` 型のヘルパーは、単一の Mastra ツールの入力型と出力型を推論します。

```typescript filename="app/types.ts" showLineNumbers copy
import { InferUITool, createTool } from '@mastra/core/tools';
import { z } from 'zod';

const weatherTool = createTool({
  id: 'get-weather',
  description: '現在の天気を取得する',
  inputSchema: z.object({
    location: z.string().describe('都市名と州名'),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    conditions: z.string(),
  }),
  execute: async ({ context }) => {
    return {
      temperature: 72,
      conditions: 'sunny',
    };
  },
});

// ツールから型を推論する
type WeatherUITool = InferUITool<typeof weatherTool>;
// 以下の型が作成されます:
// {
//   input: { location: string };
//   output: { temperature: number; conditions: string };
// }
```

#### InferUITools \{#inferuitools\}

`InferUITools` 型ヘルパーは、複数のツールの入力型と出力型を推論します。

```typescript filename="app/mastra/tools.ts" showLineNumbers copy
import { InferUITools, createTool } from '@mastra/core/tools';
import { z } from 'zod';

// 前の例のweatherToolを使用
const tools = {
  weather: weatherTool,
  calculator: createTool({
    id: 'calculator',
    description: '基本的な算術演算を実行',
    inputSchema: z.object({
      operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
      a: z.number(),
      b: z.number(),
    }),
    outputSchema: z.object({
      result: z.number(),
    }),
    execute: async ({ context }) => {
      // 実装...
      return { result: 0 };
    },
  }),
};

// ツールセットから型を推論
export type MyUITools = InferUITools<typeof tools>;
// これにより以下が作成されます:
// {
//   weather: { input: { location: string }; output: { temperature: number; conditions: string } };
//   calculator: { input: { operation: "add" | "subtract" | "multiply" | "divide"; a: number; b: number }; output: { result: number } };
// }
```

これらの型ヘルパーは、Mastra のツールを AI SDK v5 の UI コンポーネントと組み合わせて使用する際に、TypeScript を完全にサポートし、アプリケーション全体で型安全性を確保します。
