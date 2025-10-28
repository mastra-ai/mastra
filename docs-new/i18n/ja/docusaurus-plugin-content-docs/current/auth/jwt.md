---
title: JSON Web Token
description: "Mastra アプリケーションを JSON Web Token で認証する MastraJwtAuth クラスのドキュメント。"
sidebar_position: 2
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# MastraJwtAuth クラス \{#mastrajwtauth-class\}

`MastraJwtAuth` クラスは、JSON Web Token（JWT）を用いて Mastra 向けの軽量な認証機構を提供します。共有シークレットに基づいて受信リクエストを検証し、`experimental_auth` オプションを通じて Mastra サーバーと連携します。

## インストール \{#installation\}

`MastraJwtAuth` クラスを使用する前に、`@mastra/auth` パッケージをインストールする必要があります。

```bash copy
npm install @mastra/auth@latest
```

## 使い方の例 \{#usage-example\}

```typescript {2,7-9} filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { MastraJwtAuth } from '@mastra/auth';

export const mastra = new Mastra({
  // ..
  server: {
    experimental_auth: new MastraJwtAuth({
      secret: process.env.MASTRA_JWT_SECRET,
    }),
  },
});
```

> 利用可能なすべての設定オプションについては、[MastraJwtAuth](/docs/reference/auth/jwt) の API リファレンスをご覧ください。

## `MastraClient` の構成 \{#configuring-mastraclient\}

`experimental_auth` が有効な場合、`MastraClient` で送信するすべてのリクエストには、`Authorization` ヘッダーに有効な JWT を含める必要があります。

```typescript {6} filename="lib/mastra/mastra-client.ts" showLineNumbers copy
import { MastraClient } from '@mastra/client-js';

export const mastraClient = new MastraClient({
  baseUrl: 'https://<mastra-api-url>',
  headers: {
    Authorization: `Bearer ${process.env.MASTRA_JWT_TOKEN}`,
  },
});
```

> さらに詳しい設定オプションについては、[Mastra Client SDK](/docs/server-db/mastra-client)を参照してください。

### 認証リクエストの送信 \{#making-authenticated-requests\}

`MastraClient` の設定が完了したら、フロントエンドアプリケーションから認証リクエストを送信するか、手早いローカルテストには `curl` を使用できます。

<Tabs>
  <TabItem value="react" label="React">
    ```tsx filename="src/components/test-agent.tsx" showLineNumbers copy
    import { mastraClient } from "../../lib/mastra-client";

    export const TestAgent = () => {
      async function handleClick() {
        const agent = mastraClient.getAgent("weatherAgent");

        const response = await agent.generate({
          messages: "Weather in London"
        });

        console.log(response);
      }

      return <button onClick={handleClick}>Test Agent</button>;
    };
    ```
  </TabItem>

  <TabItem value="curl" label="cURL">
    ```bash copy
    curl -X POST http://localhost:4111/api/agents/weatherAgent/generate \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer <your-jwt>" \
      -d '{
        "messages": "Weather in London"
      }'
    ```
  </TabItem>
</Tabs>

## JWT の作成 \{#creating-a-jwt\}

Mastra サーバーへのリクエストを認証するには、`MASTRA_JWT_SECRET` で署名された有効な JSON Web Token (JWT) が必要です。

最も簡単な生成方法は [jwt.io](https://www.jwt.io/) を使うことです:

1. **JWT Encoder** を選択します。
2. 下にスクロールして **Sign JWT: Secret** セクションに進みます。
3. シークレットを入力します（例：`supersecretdevkeythatishs256safe!`）。
4. **Generate example** をクリックして有効な JWT を作成します。
5. 生成されたトークンをコピーし、`.env` ファイルの `MASTRA_JWT_TOKEN` に設定します。