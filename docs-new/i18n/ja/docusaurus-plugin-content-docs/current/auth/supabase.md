---
title: Supabase
description: "Supabase Auth を使用して Mastra アプリケーションを認証する MastraAuthSupabase クラスのドキュメント。"
sidebar_position: 4
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# MastraAuthSupabase クラス \{#mastraauthsupabase-class\}

`MastraAuthSupabase` クラスは、Supabase Auth を使用して Mastra の認証を提供します。Supabase の認証システムで受信リクエストを検証し、`experimental_auth` オプションを用いて Mastra サーバーと統合します。

## 前提条件 \{#prerequisites\}

この例では Supabase Auth を使用します。`.env` ファイルに Supabase の認証情報を追加し、Supabase プロジェクトが適切に設定されていることを確認してください。

```env filename=".env" copy
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

> **注意:** 適切なデータアクセス制御を徹底するため、Supabase の Row Level Security（RLS）設定を確認してください。

## インストール \{#installation\}

`MastraAuthSupabase` クラスを使用する前に、`@mastra/auth-supabase` パッケージをインストールする必要があります。

```bash copy
npm install @mastra/auth-supabase@latest
```

## 使用例 \{#usage-example\}

```typescript {2,7-9} filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { MastraAuthSupabase } from '@mastra/auth-supabase';

export const mastra = new Mastra({
  // ..
  server: {
    experimental_auth: new MastraAuthSupabase({
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
    }),
  },
});
```

> **注:** 既定の `authorizeUser` メソッドは、`public` スキーマの `users` テーブルにある `isAdmin` 列をチェックします。ユーザーの認可をカスタマイズするには、プロバイダーを作成する際にカスタムの `authorizeUser` 関数を指定してください。

> 利用可能なすべての設定オプションについては、[MastraAuthSupabase](/docs/reference/auth/supabase) の API リファレンスをご参照ください。

## クライアント側のセットアップ \{#client-side-setup\}

Supabase Auth を使用する場合は、クライアント側で Supabase からアクセストークンを取得し、それを Mastra へのリクエストに渡す必要があります。

### アクセス トークンの取得 \{#retrieving-the-access-token\}

Supabase クライアントを使ってユーザーを認証し、アクセス トークンを取得します。

```typescript filename="lib/auth.ts" showLineNumbers copy
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('<supabase-url>', '<supabase-key>');

const authTokenResponse = await supabase.auth.signInWithPassword({
  email: "<ユーザーのメール>",
  password: "<ユーザーのパスワード>",
});

const accessToken = authTokenResponse.data?.session?.access_token;
```

> OAuth やマジックリンクなど、その他の認証方法については [Supabase のドキュメント](https://supabase.com/docs/guides/auth)を参照してください。

## `MastraClient` の設定 \{#configuring-mastraclient\}

`experimental_auth` が有効な場合、`MastraClient` で行うすべてのリクエストには、`Authorization` ヘッダーに有効な Supabase のアクセストークンを含める必要があります。

```typescript {6} filename="lib/mastra/mastra-client.ts" showLineNumbers copy
import { MastraClient } from '@mastra/client-js';

export const mastraClient = new MastraClient({
  baseUrl: 'https://<mastra-api-url>',
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

> **注意:** Authorization ヘッダーでは、アクセストークンの先頭に `Bearer` を付与する必要があります。

> さらに詳しい設定オプションについては、[Mastra Client SDK](/docs/server-db/mastra-client) を参照してください。

### 認証リクエストの送信 \{#making-authenticated-requests\}

`MastraClient` に Supabase のアクセストークンを設定すると、認証付きリクエストを送信できます:

<Tabs>
  <TabItem value="react" label="React">
    ```tsx filename="src/components/test-agent.tsx" showLineNumbers copy
    import { mastraClient } from "../../lib/mastra-client";

    export const TestAgent = () => {
      async function handleClick() {
        const agent = mastraClient.getAgent("weatherAgent");

        const response = await agent.generate({
          messages: "What's the weather like in New York"
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
      -H "Authorization: Bearer <your-supabase-access-token>" \
      -d '{
        "messages": "Weather in London"
      }'
    ```
  </TabItem>
</Tabs>