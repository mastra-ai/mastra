---
title: "カスタム API ルート"
description: "Mastra サーバーから追加の HTTP エンドポイントを公開します。"
sidebar_position: 4
---

# カスタム API ルート \{#custom-api-routes\}

デフォルトでは、Mastra は登録したエージェントとワークフローをサーバー経由で自動公開します。追加の動作が必要な場合は、独自の HTTP ルートを定義できます。

ルートは `@mastra/core/server` のヘルパー関数 `registerApiRoute` で登録できます。ルートは `Mastra` インスタンスと同じファイルに置けますが、分離すると設定をより簡潔に保てます。

```typescript filename="src/mastra/index.ts" copy showLineNumbers
import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';

export const mastra = new Mastra({
  // ...
  server: {
    apiRoutes: [
      registerApiRoute('/my-custom-route', {
        method: 'GET',
        handler: async c => {
          const mastra = c.get('mastra');
          const agents = await mastra.getAgent('my-agent');

          return c.json({ message: 'カスタムルート' });
        },
      }),
    ],
  },
});
```

登録が完了すると、カスタムルートはサーバーのルートから利用できるようになります。たとえば次のとおりです：

```bash
curl http://localhost:4111/my-custom-route
```

各ルートのハンドラーは Hono の `Context` を受け取ります。ハンドラー内では `Mastra` インスタンスにアクセスして、エージェントやワークフローを取得したり呼び出したりできます。

ルート固有のミドルウェアを追加するには、`registerApiRoute` を呼び出す際に `middleware` 配列を渡してください。

```typescript filename="src/mastra/index.ts" copy showLineNumbers
import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';

export const mastra = new Mastra({
  // ...
  server: {
    apiRoutes: [
      registerApiRoute('/my-custom-route', {
        method: 'GET',
        middleware: [
          async (c, next) => {
            console.log(`${c.req.method} ${c.req.url}`);
            await next();
          },
        ],
        handler: async c => {
          return c.json({ message: 'ミドルウェア付きカスタムルート' });
        },
      }),
    ],
  },
});
```
