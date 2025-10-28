---
title: "MastraAuthAuth0 クラス"
description: "Auth0 を用いて Mastra アプリケーションを認証する MastraAuthAuth0 クラスの API リファレンス。"
---

# MastraAuthAuth0 クラス \{#mastraauthauth0-class\}

`MastraAuthAuth0` クラスは、Auth0 を使用して Mastra の認証を提供します。Auth0 が発行する JWT トークンで受信リクエストを検証し、`experimental_auth` オプションを介して Mastra サーバーと統合します。

## 使い方の例 \{#usage-example\}

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { MastraAuthAuth0 } from '@mastra/auth-auth0';

export const mastra = new Mastra({
  // ..
  server: {
    experimental_auth: new MastraAuthAuth0({
      domain: process.env.AUTH0_DOMAIN,
      audience: process.env.AUTH0_AUDIENCE,
    }),
  },
});
```

> **注意:** 適切に名前付けされた環境変数（`AUTH0_DOMAIN` と `AUTH0_AUDIENCE`）が設定されていれば、コンストラクターのパラメーターは省略できます。その場合は、引数なしで `new MastraAuthAuth0()` を使用してください。

## コンストラクターのパラメーター \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "domain",
type: "string",
description: "Auth0 ドメイン（例: your-tenant.auth0.com）。Auth0 テナントが発行した JWT トークンの検証に使用します。",
isOptional: true,
defaultValue: "process.env.AUTH0_DOMAIN"
},
{
name: "audience",
type: "string",
description: "Auth0 の API 識別子（audience）。トークンが特定の API を対象としていることを保証します。",
isOptional: true,
defaultValue: "process.env.AUTH0_AUDIENCE"
},
{
name: "name",
type: "string",
description: "認証プロバイダーインスタンスのカスタム名。",
isOptional: true,
defaultValue: '"auth0"'
},
{
name: "authorizeUser",
type: "(user: Auth0User) => Promise<boolean> | boolean",
description: "ユーザーにアクセスを許可するかを判定するカスタム認可関数。トークン検証後に呼び出されます。デフォルトでは、有効なトークンを持つ認証済みユーザーをすべて許可します。",
isOptional: true,
},
]}
/>

## 環境変数 \{#environment-variables\}

コンストラクターのオプションが指定されていない場合は、次の環境変数が自動的に使用されます。

<PropertiesTable
  content={[
{
name: "AUTH0_DOMAIN",
type: "string",
description: "Auth0 のドメイン。Auth0 Dashboard の「Applications > Settings」で確認できます。",
isOptional: true,
},
{
name: "AUTH0_AUDIENCE",
type: "string",
description: "Auth0 API の識別子。Auth0 Dashboard で API を作成する際に設定した ID です。",
isOptional: true,
},
]}
/>

## デフォルトの認可動作 \{#default-authorization-behavior\}

デフォルトでは、`MastraAuthAuth0` は Auth0 の JWT トークンを検証し、認証済みユーザー全員のアクセスを許可します:

1. **トークン検証**: JWT トークンを Auth0 の公開鍵（JWKS）で検証します
2. **署名の検証**: トークンが自分の Auth0 テナントで署名されていることを確認します
3. **有効期限の確認**: トークンが失効していないことを確認します
4. **オーディエンスの検証**: トークンが特定の API（audience）向けに発行されていることを確認します
5. **発行者の検証**: トークンが自分の Auth0 ドメインで発行されていることを確認します

すべての検証を通過した場合、ユーザーは認可済みとみなされます。カスタムの認可ロジック（例: ロールベースのアクセス制御）を実装するには、カスタムの `authorizeUser` 関数を用意してください。

## Auth0 ユーザー型 \{#auth0-user-type\}

`authorizeUser` 関数で使用される `Auth0User` 型は、デコード済みの JWT トークンのペイロードに対応しており、通常は次を含みます:

* `sub`: ユーザーの一意の識別子（subject）
* `email`: ユーザーのメールアドレス（トークンに含まれている場合）
* `email_verified`: メールアドレスが確認済みかどうか
* `name`: ユーザーの表示名（利用可能な場合）
* `picture`: ユーザーのプロフィール画像のURL（利用可能な場合）
* `iss`: トークンの発行者（Auth0 ドメイン）
* `aud`: トークンの受信者（API 識別子）
* `iat`: トークンの発行時刻
* `exp`: トークンの有効期限（タイムスタンプ）
* `scope`: トークンに付与されたスコープ
* Auth0 テナントで設定されたカスタムクレームおよびアプリメタデータ

利用可能なプロパティは、Auth0 の設定、要求するスコープ、設定したカスタムクレームによって異なります。

## 関連項目 \{#related\}

[MastraAuthAuth0 クラス](/docs/auth/auth0)