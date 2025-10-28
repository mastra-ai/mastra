---
title: "MastraJwtAuth クラス"
description: "JSON Web Token を使用して Mastra アプリケーションを認証する MastraJwtAuth クラスの API リファレンス。"
---

# MastraJwtAuth クラス \{#mastrajwtauth-class\}

`MastraJwtAuth` クラスは、JSON Web Token（JWT）を用いた、Mastra 向けの軽量な認証機構を提供します。共有シークレットに基づいて受信リクエストを検証し、`experimental_auth` オプションを通じて Mastra サーバーと連携します。

## 使い方の例 \{#usage-example\}

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { MastraJwtAuth } from '@mastra/auth';

export const mastra = new Mastra({
  // ..
  server: {
    experimental_auth: new MastraJwtAuth({
      secret: '<your-secret>',
    }),
  },
});
```

## コンストラクターのパラメーター \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "secret",
type: "string",
description: "受信リクエストを認証するための JSON Web Token (JWT) の署名および検証に使用される一意の文字列。",
isOptional: false,
},
]}
/>

## 関連情報 \{#related\}

[MastraJwtAuth](/docs/auth/jwt)