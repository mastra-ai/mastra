---
title: "MastraAuthClerk クラス"
description: "Clerk 認証で Mastra アプリケーションを認証する MastraAuthClerk クラスの API リファレンス。"
---

# MastraAuthClerk クラス \{#mastraauthclerk-class\}

`MastraAuthClerk` クラスは、Clerk を用いて Mastra アプリケーションの認証を提供します。Clerk が発行した JWT トークンで受信リクエストを検証し、`experimental_auth` オプションを介して Mastra サーバーと統合します。

## 使い方の例 \{#usage-example\}

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { MastraAuthClerk } from '@mastra/auth-clerk';

export const mastra = new Mastra({
  // ..
  server: {
    experimental_auth: new MastraAuthClerk({
      jwksUri: process.env.CLERK_JWKS_URI,
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
      secretKey: process.env.CLERK_SECRET_KEY,
    }),
  },
});
```

## コンストラクターのパラメーター \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "publishableKey",
type: "string",
description: "Clerk の公開キー。Clerk ダッシュボードの API Keys で確認できます。",
isOptional: true,
defaultValue: "process.env.CLERK_PUBLISHABLE_KEY"
},
{
name: "secretKey",
type: "string",
description: "Clerk のシークレットキー。サーバーサイドの認証およびトークン検証に使用されます。",
isOptional: true,
defaultValue: "process.env.CLERK_SECRET_KEY"
},
{
name: "jwksUri",
type: "string",
description: "Clerk アプリケーションの JWKS URI。JWT の署名検証に使用されます。",
isOptional: true,
defaultValue: "process.env.CLERK_JWKS_URI"
},
{
name: "name",
type: "string",
description: "認証プロバイダーインスタンスのカスタム名。",
isOptional: true,
},
{
name: "authorizeUser",
type: "(user: User, request: HonoRequest) => Promise<boolean> | boolean",
description: "ユーザーにアクセスを許可するか判断するカスタム認可関数。トークン検証後に呼び出されます。既定では、認証済みのすべてのユーザーを許可します。",
isOptional: true,
},
]}
/>

## 関連項目 \{#related\}

[MastraAuthClerk クラス](/docs/auth/clerk)