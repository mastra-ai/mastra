---
title: "MastraAuthWorkos クラス"
description: "WorkOS による認証で Mastra アプリケーションを認証する MastraAuthWorkos クラスの API リファレンス。"
---

# MastraAuthWorkos クラス \{#mastraauthworkos-class\}

`MastraAuthWorkos` クラスは、WorkOS を用いて Mastra の認証を提供します。WorkOS のアクセストークンで受信リクエストを検証し、`experimental_auth` オプションを通じて Mastra サーバーと統合します。

## 使い方の例 \{#usage-example\}

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { MastraAuthWorkos } from '@mastra/auth-workos';

export const mastra = new Mastra({
  // ..
  server: {
    experimental_auth: new MastraAuthWorkos({
      apiKey: process.env.WORKOS_API_KEY,
      clientId: process.env.WORKOS_CLIENT_ID,
    }),
  },
});
```

> **注:** `WORKOS_API_KEY` と `WORKOS_CLIENT_ID` という名前の環境変数が設定されていれば、コンストラクターのパラメーターは省略できます。その場合は、引数なしで `new MastraAuthWorkos()` を使用してください。

## コンストラクターのパラメータ \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "apiKey",
type: "string",
description: "WorkOS の API キー。ユーザーの本人確認および組織管理のために、WorkOS API への認証に使用します。",
isOptional: true,
defaultValue: "process.env.WORKOS_API_KEY"
},
{
name: "clientId",
type: "string",
description: "WorkOS のクライアント ID。認可コードをアクセストークンに交換する際に、アプリケーションを識別します。",
isOptional: true,
defaultValue: "process.env.WORKOS_CLIENT_ID"
},
{
name: "name",
type: "string",
description: "認証プロバイダーインスタンスのカスタム名。",
isOptional: true,
defaultValue: '"workos"'
},
{
name: "authorizeUser",
type: "(user: WorkosUser) => Promise<boolean> | boolean",
description: "ユーザーにアクセス権を付与すべきかを判定するカスタム認可関数。トークン検証後に呼び出されます。既定では、ユーザーがいずれかの組織メンバーシップで「admin」ロールを持っているかを確認します。",
isOptional: true,
},
]}
/>

## 環境変数 \{#environment-variables\}

コンストラクターのオプションが指定されていない場合、以下の環境変数が自動的に使用されます：

<PropertiesTable
  content={[
{
name: "WORKOS_API_KEY",
type: "string",
description: "WorkOS の API キー。WorkOS ダッシュボードの「API Keys」で確認できます。",
isOptional: true,
},
{
name: "WORKOS_CLIENT_ID",
type: "string",
description: "WorkOS のクライアント ID。WorkOS ダッシュボードの「Applications」で確認できます。",
isOptional: true,
},
]}
/>

## デフォルトの認可動作 \{#default-authorization-behavior\}

デフォルトでは、`MastraAuthWorkos` は管理者アクセスの有無を確認するロールベース認可を実装しています。

1. トークンの検証: アクセストークンが有効で期限切れでないことを確認するため、WorkOS で検証します
2. ユーザー取得: 検証済みトークンからユーザー情報を抽出します
3. 組織メンバーシップの確認: ユーザーの ID にひも付くすべての組織メンバーシップを WorkOS に問い合わせます
4. ロールの抽出: ユーザーの組織メンバーシップからすべてのロールを収集します
5. 管理者チェック: いずれかのロールにスラッグ &#39;admin&#39; が含まれるかを確認します
6. 認可の判定: 少なくとも 1 つの組織でユーザーが管理者ロールを持っている場合にのみアクセスを許可します

つまり、デフォルトでは、少なくとも 1 つの組織で管理者権限を持つユーザーだけが、Mastra のエンドポイントにアクセスできます。

カスタムの認可ロジック（例: 認証済みユーザー全員を許可、特定のロールを確認、独自のビジネスロジックを適用）を実装するには、カスタムの `authorizeUser` 関数を提供してください。

## WorkOS のユーザー型 \{#workos-user-type\}

`authorizeUser` 関数で使用される `WorkosUser` 型は、WorkOS から返される JWT トークンのペイロードに対応します。WorkOS では管理者がカスタムの JWT テンプレートを設定できるため、具体的な構造は設定により異なる場合があります。以下は、ユーザーオブジェクトの例です。

```javascript
{
  'urn:myapp:full_name': 'John Doe',
  'urn:myapp:email': 'john.doe@example.com',
  'urn:myapp:organization_tier': 'bronze',
  'urn:myapp:user_language': 'ja',
  'urn:myapp:organization_domain': 'example.com',
  iss: 'https://api.workos.com/user_management/client_01ABC123DEF456GHI789JKL012',
  sub: 'user_01XYZ789ABC123DEF456GHI012',
  sid: 'session_01PQR456STU789VWX012YZA345',
  jti: '01MNO678PQR901STU234VWX567',
  org_id: 'org_01DEF234GHI567JKL890MNO123',
  role: 'member',
  roles: [ 'member' ],
  permissions: [],
  exp: 1758290589,
  iat: 1758290289
}
```

`urn:myapp:` プレフィックスの付いたプロパティは、WorkOS の JWT テンプレートで設定されたカスタムクレームです。標準の JWT クレームには `sub`（ユーザー ID）、`iss`（発行者）、`exp`（有効期限）があり、WorkOS 固有のクレームとして `org_id`、`role`、`roles` などがあります。

## 関連項目 \{#related\}

[MastraAuthWorkos クラス](/docs/auth/workos)