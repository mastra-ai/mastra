---
title: "MastraAuthFirebase クラス"
description: "Firebase Authentication で Mastra アプリケーションを認証する MastraAuthFirebase クラスの API リファレンス。"
---

# MastraAuthFirebase クラス \{#mastraauthfirebase-class\}

`MastraAuthFirebase` クラスは、Firebase Authentication を利用して Mastra の認証を実現します。Firebase の ID トークンで受信リクエストを検証し、`experimental_auth` オプションを通じて Mastra サーバーと連携します。

## 利用例 \{#usage-examples\}

### 環境変数を使った基本的な使い方 \{#basic-usage-with-environment-variables\}

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { MastraAuthFirebase } from '@mastra/auth-firebase';

// FIREBASE_SERVICE_ACCOUNT および FIRESTORE_DATABASE_ID 環境変数を自動的に使用します
export const mastra = new Mastra({
  // ..
  server: {
    experimental_auth: new MastraAuthFirebase(),
  },
});
```

### カスタム設定 \{#custom-configuration\}

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { MastraAuthFirebase } from '@mastra/auth-firebase';

export const mastra = new Mastra({
  // ..
  server: {
    experimental_auth: new MastraAuthFirebase({
      serviceAccount: '/path/to/service-account-key.json',
      databaseId: 'your-database-id',
    }),
  },
});
```

## コンストラクターのパラメーター \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "serviceAccount",
type: "string",
description: "Firebase のサービス アカウント JSON ファイルへのパス。サーバー側で Firebase ID トークンを検証するために必要な認証情報が含まれます。",
isOptional: true,
defaultValue: "process.env.FIREBASE_SERVICE_ACCOUNT"
},
{
name: "databaseId",
type: "string",
description: "使用する Firestore のデータベース ID。通常はデフォルト データベースのため '(default)' を指定します。",
isOptional: true,
defaultValue: "process.env.FIRESTORE_DATABASE_ID || process.env.FIREBASE_DATABASE_ID"
},
{
name: "name",
type: "string",
description: "認証プロバイダー インスタンスのカスタム名。",
isOptional: true,
defaultValue: '"firebase"'
},
{
name: "authorizeUser",
type: "(user: FirebaseUser) => Promise<boolean> | boolean",
description: "ユーザーにアクセス権を付与すべきかを判定するためのカスタム認可関数。トークン検証後に呼び出されます。既定では、ユーザーの UID をキーとする 'user_access' コレクション内にドキュメントが存在するかを確認します。",
isOptional: true,
},
]}
/>

## 環境変数 \{#environment-variables\}

コンストラクターのオプションが指定されていない場合、次の環境変数が自動的に使用されます。

<PropertiesTable
  content={[
{
name: "FIREBASE_SERVICE_ACCOUNT",
type: "string",
description: "Firebase サービス アカウントの JSON ファイルへのパス。serviceAccount オプションが指定されていない場合に使用されます。",
isOptional: true,
},
{
name: "FIRESTORE_DATABASE_ID",
type: "string",
description: "Firestore のデータベース ID。データベース設定の主となる環境変数です。",
isOptional: true,
},
{
name: "FIREBASE_DATABASE_ID",
type: "string",
description: "Firestore のデータベース ID 用の代替環境変数。FIRESTORE_DATABASE_ID が設定されていない場合に使用されます。",
isOptional: true,
},
]}
/>

## デフォルトの認可動作 \{#default-authorization-behavior\}

デフォルトでは、`MastraAuthFirebase` は Firestore を使ってユーザーのアクセスを管理します。

1. Firebase ID トークンの検証に成功すると、`authorizeUser` メソッドが呼び出される
2. `user_access` コレクションに、ユーザーの UID をドキュメント ID とするドキュメントが存在するかを確認する
3. ドキュメントが存在すればユーザーは認可され、存在しなければアクセスは拒否される
4. 使用される Firestore データベースは、`databaseId` パラメータまたは環境変数によって決定される

## Firebase ユーザー型 \{#firebase-user-type\}

`authorizeUser` 関数で使用される `FirebaseUser` 型は、Firebase の `DecodedIdToken` インターフェースに対応しており、次の情報を含みます:

* `uid`: ユーザーの一意の識別子
* `email`: ユーザーのメールアドレス（存在する場合）
* `email_verified`: メールアドレスが確認済みかどうか
* `name`: ユーザーの表示名（存在する場合）
* `picture`: ユーザーのプロフィール画像の URL（存在する場合）
* `auth_time`: ユーザーが認証した時刻
* そのほか標準的な JWT クレーム

## 関連項目 \{#related\}

[MastraAuthFirebase クラス](/docs/auth/firebase)