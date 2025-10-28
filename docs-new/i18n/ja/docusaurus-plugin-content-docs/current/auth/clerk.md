---
title: Clerk
description: "Clerk 認証を用いて Mastra アプリケーションを認証する MastraAuthClerk クラスのドキュメント。"
sidebar_position: 3
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# MastraAuthClerk クラス \{#mastraauthclerk-class\}

`MastraAuthClerk` クラスは、Clerk を用いて Mastra の認証を提供します。Clerk の認証システムで受信リクエストを検証し、`experimental_auth` オプションを通じて Mastra サーバーと統合します。

## 前提条件 \{#prerequisites\}

この例では Clerk 認証を使用します。`.env` ファイルに Clerk のクレデンシャルを追加し、Clerk プロジェクトが正しく設定されていることを確認してください。

```env filename=".env" copy
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_JWKS_URI=https://your-clerk-domain.clerk.accounts.dev/.well-known/jwks.json
```

> **注:** これらのキーは、Clerk ダッシュボードの「API Keys」で確認できます。

## インストール \{#installation\}

`MastraAuthClerk` クラスを使用する前に、`@mastra/auth-clerk` パッケージをインストールしておく必要があります。

```bash copy
npm install @mastra/auth-clerk@latest
```

## 使い方の例 \{#usage-example\}

```typescript {2,7-11} filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { MastraAuthClerk } from '@mastra/auth-clerk';

export const mastra = new Mastra({
  // ..
  server: {
    experimental_auth: new MastraAuthClerk({
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
      secretKey: process.env.CLERK_SECRET_KEY,
      jwksUri: process.env.CLERK_JWKS_URI,
    }),
  },
});
```

> **注意:** 既定の `authorizeUser` メソッドでは、認証済みのユーザーはすべて許可されます。ユーザーの認可をカスタマイズするには、プロバイダーを構成する際にカスタムの `authorizeUser` 関数を指定してください。

> 利用可能なすべての設定オプションについては、[MastraAuthClerk](/docs/reference/auth/clerk) の API リファレンスを参照してください。

## クライアント側のセットアップ \{#client-side-setup\}

Clerk 認証を使用する場合は、クライアント側で Clerk からアクセストークンを取得し、それを Mastra へのリクエストに添えて送信する必要があります。

### アクセストークンの取得 \{#retrieving-the-access-token\}

Clerk の React フックを使ってユーザーを認証し、アクセストークンを取得します。

```typescript filename="lib/auth.ts" showLineNumbers copy
import { useAuth } from '@clerk/nextjs';

export const useClerkAuth = () => {
  const { getToken } = useAuth();

  const getAccessToken = async () => {
    const token = await getToken();
    return token;
  };

  return { getAccessToken };
};
```

> 詳細は [Clerk のドキュメント](https://clerk.com/docs)をご覧ください。

## `MastraClient` の設定 \{#configuring-mastraclient\}

`experimental_auth` が有効な場合、`MastraClient` で行うすべてのリクエストには、`Authorization` ヘッダーに有効な Clerk のアクセストークンを含める必要があります。

```typescript {6} filename="lib/mastra/mastra-client.ts" showLineNumbers copy
import { MastraClient } from '@mastra/client-js';

export const mastraClient = new MastraClient({
  baseUrl: 'https://<mastra-api-url>',
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

> **注意:** アクセストークンは Authorization ヘッダーで `Bearer` を前置する必要があります。
> そのほかの設定オプションについては [Mastra Client SDK](/docs/server-db/mastra-client) を参照してください。

### 認証付きリクエストの送信 \{#making-authenticated-requests\}

`MastraClient` を Clerk のアクセストークンで設定したら、認証付きリクエストを送信できます。

<Tabs>
  <TabItem value="react" label="React">
    ```tsx filename="src/components/test-agent.tsx" showLineNumbers copy
    "use client";

    import { useAuth } from "@clerk/nextjs";
    import { MastraClient } from "@mastra/client-js";

    export const TestAgent = () => {
      const { getToken } = useAuth();

      async function handleClick() {
        const token = await getToken();

        const client = new MastraClient({
          baseUrl: "http://localhost:4111",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        const weatherAgent = client.getAgent("weatherAgent");
        const response = await weatherAgent.generate({
          messages: "ニューヨークの天気はどうですか？",
        });

        console.log({ response });
      }

      return <button onClick={handleClick}>Test Agent</button>;
    };
    ```
  </TabItem>

  <TabItem value="curl" label="cURL">
    ```bash copy
    curl -X POST http://localhost:4111/api/agents/weatherAgent/generate \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer <your-clerk-access-token>" \
      -d '{
        "messages": "ロンドンの天気"
      }'
    ```
  </TabItem>
</Tabs>