---
title: "MastraAuthSupabase クラス"
description: "Supabase Auth を用いて Mastra アプリを認証する MastraAuthSupabase クラスの API リファレンス。"
---

# MastraAuthSupabase クラス \{#mastraauthsupabase-class\}

`MastraAuthSupabase` クラスは、Supabase Auth を用いて Mastra の認証を提供します。Supabase の認証システムで受信リクエストを検証し、`experimental_auth` オプションを使って Mastra サーバーと統合します。

## 使い方の例 \{#usage-example\}

```typescript filename="src/mastra/index.ts" showLineNumbers copy
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

## コンストラクターのパラメーター \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "url",
type: "string",
description: "Supabase プロジェクトの URL。プロジェクトの設定で確認できます。",
isOptional: true,
defaultValue: "process.env.SUPABASE_URL"
},
{
name: "anonKey",
type: "string",
description: "Supabase プロジェクトの匿名/公開キー。クライアント側の認証に使用されます。",
isOptional: true,
defaultValue: "process.env.SUPABASE_ANON_KEY"
},
{
name: "name",
type: "string",
description: "認証プロバイダーインスタンスのカスタム名。",
isOptional: true,
},
{
name: "authorizeUser",
type: "(user: User, request: HoneRequest) => Promise<boolean> | boolean",
description: "ユーザーにアクセスを付与すべきかを判定するカスタム認可関数。トークン検証後に呼び出されます。既定では 'users' テーブルの 'isAdmin' 列を確認します。",
isOptional: true,
},
]}
/>

## 関連情報 \{#related\}

[MastraAuthSupabase](/docs/auth/supabase)