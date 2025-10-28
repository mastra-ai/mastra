---
title: Firebase
description: "Firebase Authentication を使用して Mastra アプリケーションを認証する MastraAuthFirebase クラスのドキュメント。"
sidebar_position: 5
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# MastraAuthFirebase クラス \{#mastraauthfirebase-class\}

`MastraAuthFirebase` クラスは、Firebase Authentication を用いて Mastra の認証を提供します。Firebase の ID トークンで受信リクエストを検証し、`experimental_auth` オプションを通じて Mastra サーバーと統合します。

## 前提条件 \{#prerequisites\}

この例では Firebase Authentication を使用します。次の点を確認してください:

1. [Firebase Console](https://console.firebase.google.com/) で Firebase プロジェクトを作成する
2. Authentication を有効にし、希望するサインイン方法（Google、メール/パスワード など）を設定する
3. Project Settings &gt; Service Accounts からサービスアカウントキーを作成する
4. サービスアカウントの JSON ファイルをダウンロードする

```env filename=".env" copy
FIREBASE_SERVICE_ACCOUNT=/path/to/your/service-account-key.json
FIRESTORE_DATABASE_ID=(default)
# 代替の環境変数名：
# FIREBASE_DATABASE_ID=(default)
```

> **注意:** サービス アカウントの JSON ファイルは安全に保管し、絶対にバージョン管理にコミットしないでください。

## インストール \{#installation\}

`MastraAuthFirebase` クラスを使用する前に、`@mastra/auth-firebase` パッケージをインストールしてください。

```bash copy
npm で @mastra/auth-firebase@latest をインストール
```

## 使い方の例 \{#usage-examples\}

### 環境変数を用いた基本的な使い方 \{#basic-usage-with-environment-variables\}

必須の環境変数（`FIREBASE_SERVICE_ACCOUNT` と `FIRESTORE_DATABASE_ID`）を設定すると、`MastraAuthFirebase` はコンストラクタ引数なしで初期化できます。クラスはこれらの環境変数を設定として自動的に読み込みます。

```typescript {2,7} filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { MastraAuthFirebase } from '@mastra/auth-firebase';

// 環境変数 FIREBASE_SERVICE_ACCOUNT と FIRESTORE_DATABASE_ID を自動的に使用します
export const mastra = new Mastra({
  // ..
  server: {
    experimental_auth: new MastraAuthFirebase(),
  },
});
```

### カスタム設定 \{#custom-configuration\}

```typescript {2,7-10} filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { MastraAuthFirebase } from '@mastra/auth-firebase';

export const mastra = new Mastra({
  // ..
  server: {
    experimental_auth: new MastraAuthFirebase({
      serviceAccount: '/path/to/service-account.json',
      databaseId: 'your-database-id',
    }),
  },
});
```

## 設定 \{#configuration\}

`MastraAuthFirebase` クラスは、コンストラクターのオプションまたは環境変数によって構成できます。

### 環境変数 \{#environment-variables\}

* `FIREBASE_SERVICE_ACCOUNT`: Firebase サービス アカウントの JSON ファイルへのパス
* `FIRESTORE_DATABASE_ID` または `FIREBASE_DATABASE_ID`: Firestore のデータベース ID

> **注:** コンストラクターのオプションが指定されていない場合、クラスは自動的にこれらの環境変数を読み取ります。つまり、環境変数が正しく設定されていれば、引数なしで `new MastraAuthFirebase()` を呼び出すだけで済みます。

### ユーザー認可 \{#user-authorization\}

`MastraAuthFirebase` は、デフォルトで Firestore を使ってユーザーのアクセスを管理します。`user_access` という名前のコレクションがあり、各ドキュメントのキーとしてユーザーの UID を用いることを想定しています。このコレクションに該当ドキュメントが存在するかどうかで、そのユーザーが認可されているかが判断されます。

```typescript filename="firestore-structure.txt" copy
user_access/
  {user_uid_1}/     // ドキュメントが存在する＝ユーザーは認可済み
  {user_uid_2}/     // ドキュメントが存在する＝ユーザーは認可済み
```

ユーザーの認可をカスタマイズするには、独自の `authorizeUser` 関数を用意してください。

```typescript filename="src/mastra/auth.ts" showLineNumbers copy
import { MastraAuthFirebase } from '@mastra/auth-firebase';

const firebaseAuth = new MastraAuthFirebase({
  authorizeUser: async user => {
    // カスタムの認可ロジック
    return user.email?.endsWith('@yourcompany.com') || false;
  },
});
```

> 利用可能な設定オプションの一覧は、[MastraAuthFirebase](/docs/reference/auth/firebase) の API リファレンスをご参照ください。

## クライアント側のセットアップ \{#client-side-setup\}

Firebase Authentication を使用する場合は、クライアント側で Firebase を初期化し、ユーザーを認証して、Mastra へのリクエストに渡すための ID トークンを取得する必要があります。

### クライアントでの Firebase の設定 \{#setting-up-firebase-on-the-client\}

まず、クライアントアプリで Firebase を初期化します：

```typescript filename="lib/firebase.ts" showLineNumbers copy
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
```

### ユーザーの認証とトークンの取得 \{#authenticating-users-and-retrieving-tokens\}

Firebase 認証を使ってユーザーにサインインし、ID トークンを取得します。

```typescript filename="lib/auth.ts" showLineNumbers copy
import { signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleProvider } from './firebase';

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('サインインでエラーが発生しました:', error);
    throw error;
  }
};

export const getIdToken = async (user: User) => {
  try {
    const idToken = await user.getIdToken();
    return idToken;
  } catch (error) {
    console.error('ID トークン取得時にエラーが発生しました:', error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('サインアウトでエラーが発生しました:', error);
    throw error;
  }
};
```

> メール/パスワードや電話認証など、他の認証方法については [Firebase のドキュメント](https://firebase.google.com/docs/auth) を参照してください。

## `MastraClient` の構成 \{#configuring-mastraclient\}

`experimental_auth` が有効な場合、`MastraClient` で行うすべてのリクエストには、`Authorization` ヘッダーに有効な Firebase ID トークンを含める必要があります。

```typescript {6} filename="lib/mastra/mastra-client.ts" showLineNumbers copy
import { MastraClient } from '@mastra/client-js';

export const createMastraClient = (idToken: string) => {
  return new MastraClient({
    baseUrl: 'https://<mastra-api-url>',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
};
```

> **注記:** Authorization ヘッダーでは、ID トークンの前に `Bearer` を付ける必要があります。

> さらに詳しい設定オプションは、[Mastra Client SDK](/docs/server-db/mastra-client) を参照してください。

### 認証リクエストの送信 \{#making-authenticated-requests\}

`MastraClient` に Firebase の ID トークンを設定すると、認証付きのリクエストを送信できます。

<Tabs>
  <TabItem value="react" label="React">
    ```tsx filename="src/components/test-agent.tsx" showLineNumbers copy
    "use client";

    import { useAuthState } from 'react-firebase-hooks/auth';
    import { MastraClient } from "@mastra/client-js";
    import { auth } from '../lib/firebase';
    import { getIdToken } from '../lib/auth';

    export const TestAgent = () => {
      const [user] = useAuthState(auth);

      async function handleClick() {
        if (!user) return;

        const token = await getIdToken(user);
        const client = createMastraClient(token);

        const weatherAgent = client.getAgent("weatherAgent");
        const response = await weatherAgent.generate({
          messages: "What's the weather like in New York",
        });

        console.log({ response });
      }

      return (
        <button onClick={handleClick} disabled={!user}>
          Test Agent
        </button>
      );
    };
    ```
  </TabItem>

  <TabItem value="nodejs" label="Node.js">
    ```typescript filename="server.js" showLineNumbers copy
    const express = require('express');
    const admin = require('firebase-admin');
    const { MastraClient } = require('@mastra/client-js');

    // Firebase Admin を初期化
    admin.initializeApp({
      credential: admin.credential.cert({
        // サービスアカウントの認証情報
      })
    });

    const app = express();
    app.use(express.json());

    app.post('/generate', async (req, res) => {
      try {
        const { idToken } = req.body;

        // トークンを検証
        await admin.auth().verifyIdToken(idToken);

        const mastra = new MastraClient({
          baseUrl: "http://localhost:4111",
          headers: {
            Authorization: `Bearer ${idToken}`
          }
        });

        const weatherAgent = mastra.getAgent("weatherAgent");
        const response = await weatherAgent.generate({
          messages: "What's the weather like in Nairobi"
        });

        res.json({ response: response.text });
      } catch (error) {
        res.status(401).json({ error: 'Unauthorized' });
      }
    });
    ```
  </TabItem>

  <TabItem value="curl" label="cURL">
    ```bash copy
    curl -X POST http://localhost:4111/api/agents/weatherAgent/generate \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer <your-firebase-id-token>" \
      -d '{
        "messages": "Weather in London"
      }'
    ```
  </TabItem>
</Tabs>