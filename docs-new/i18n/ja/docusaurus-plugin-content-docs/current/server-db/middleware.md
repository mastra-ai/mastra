---
title: "ミドルウェア"
description: "リクエストを横取りするカスタムミドルウェア関数を適用します。"
sidebar_position: 2
---

# ミドルウェア \{#middleware\}

Mastra サーバーは、API のルートハンドラーが呼び出される前後にカスタムミドルウェア関数を実行できます。これは、認証、ログ、リクエスト固有のコンテキストの付与、CORS ヘッダーの追加などに役立ちます。

ミドルウェアは [Hono](https://hono.dev) の `Context`（`c`）と `next` 関数を受け取ります。`Response` を返した場合、その時点でリクエスト処理は打ち切られます。`next()` を呼び出すと、次のミドルウェアまたはルートハンドラーの処理に進みます。

```typescript copy showLineNumbers
import { Mastra } from '@mastra/core';

export const mastra = new Mastra({
  server: {
    middleware: [
      {
        handler: async (c, next) => {
          // 例: 認証チェックを追加
          const authHeader = c.req.header('Authorization');
          if (!authHeader) {
            return new Response('Unauthorized', { status: 401 });
          }

          await next();
        },
        path: '/api/*',
      },
      // グローバルリクエストロガーを追加
      async (c, next) => {
        console.log(`${c.req.method} ${c.req.url}`);
        await next();
      },
    ],
  },
});
```

単一のルートにミドルウェアを適用するには、`registerApiRoute` に `middleware` オプションを渡します:

```typescript copy showLineNumbers
registerApiRoute('/my-custom-route', {
  method: 'GET',
  middleware: [
    async (c, next) => {
      console.log(`${c.req.method} ${c.req.url}`);
      await next();
    },
  ],
  handler: async c => {
    const mastra = c.get('mastra');
    return c.json({ message: 'Hello, world!' });
  },
});
```

***

## よくある例 \{#common-examples\}

### 認証 \{#authentication\}

```typescript copy
{
  handler: async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response('未認証', { status: 401 });
    }

    // トークンを検証
    await next();
  },
  path: '/api/*',
}
```

### CORS サポート \{#cors-support\}

```typescript copy
{
  handler: async (c, next) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS',
    );
    c.header(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization',
    );

    if (c.req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    await next();
  },
}
```

### リクエストのログ \{#request-logging\}

```typescript copy
{
  handler: async (c, next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;
    console.log(`${c.req.method} ${c.req.url} - ${duration}ms`);
  },
}
```

### Mastra の特別なヘッダー \{#special-mastra-headers\}

Mastra Cloud やカスタムクライアントと統合する際、以下のヘッダーは
ミドルウェアで参照して動作を調整できます。

```typescript copy
{
  handler: async (c, next) => {
    const isFromMastraCloud = c.req.header('x-mastra-cloud') === 'true';
    const clientType = c.req.header('x-mastra-client-type');
    const isDevPlayground =
      c.req.header('x-mastra-dev-playground') === 'true';

    if (isFromMastraCloud) {
      // 特別な処理
    }
    await next();
  },
}
```

* `x-mastra-cloud`: リクエストが Mastra Cloud から送信されたことを示す
* `x-mastra-client-type`: クライアント SDK を識別する（例：`js` または `python`）
* `x-mastra-dev-playground`: ローカルのプレイグラウンドから発行されたリクエスト

### `runtimeContext` の設定 \{#setting-runtimecontext\}

サーバーのミドルウェアで、リクエストから情報を抽出して `runtimeContext` を動的に設定できます。次の例では、Cloudflare の `CF-IPCountry` ヘッダーに基づいて `temperature-unit` を設定し、レスポンスがユーザーのロケールに合致するようにしています。

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { testWeatherAgent } from './agents/test-weather-agent';
import { WeatherRuntimeContext } from './mastra/tools/test-weather-tool';

export const mastra = new Mastra({
  agents: { testWeatherAgent },
  server: {
    middleware: [
      async (context, next) => {
        const country = context.req.header('CF-IPCountry');
        const runtimeContext = context.get('runtimeContext') as RuntimeContext<WeatherRuntimeContext>;

        runtimeContext.set('temperature-unit', country === 'US' ? 'fahrenheit' : 'celsius');

        await next();
      },
    ],
  },
});
```
