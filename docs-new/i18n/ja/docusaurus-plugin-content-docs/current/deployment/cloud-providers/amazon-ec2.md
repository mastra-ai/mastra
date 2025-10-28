---
title: "Amazon EC2"
description: "Mastra アプリケーションを Amazon EC2 へデプロイする。"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Amazon EC2 \{#amazon-ec2\}

Mastra アプリケーションを Amazon EC2（Elastic Compute Cloud）にデプロイします。

:::note

このガイドは、Mastra アプリケーションがデフォルトの
`npx create-mastra@latest` コマンドで作成されていることを前提としています。
新しい Mastra アプリケーションの作成方法については、
[はじめに](/docs/getting-started/installation)を参照してください。

:::

## 前提条件 \{#prerequisites\}

* [EC2](https://aws.amazon.com/ec2/) にアクセス可能な AWS アカウント
* Ubuntu 24 以降または Amazon Linux を実行している EC2 インスタンス
* インスタンスを指す A レコードが設定されたドメイン名
* リバースプロキシの設定（例: [nginx](https://nginx.org/) の利用）
* SSL 証明書の設定（例: [Let&#39;s Encrypt](https://letsencrypt.org/) の利用）
* インスタンスに Node.js 18 以上がインストール済み

## デプロイ手順 \{#deployment-steps\}

### Mastra アプリをクローンする \{#clone-your-mastra-application\}

EC2 インスタンスに接続し、リポジトリをクローンします:

<Tabs>
  <TabItem value="tab-1" label="Tab 1">
    ```bash copy
    git clone https://github.com/<your-username>/<your-repository>.git
    ```
  </TabItem>

  <TabItem value="tab-2" label="Tab 2">
    ```bash copy
    git clone https://<your-username>:<your-personal-access-token>@github.com/<your-username>/<your-repository>.git
    ```
  </TabItem>
</Tabs>

リポジトリのディレクトリへ移動します:

```bash copy
cd "<your-repository>"
```

### 依存関係のインストール \{#install-dependencies\}

```bash copy
npm install
```

### 環境変数を設定する \{#set-up-environment-variables\}

`.env` ファイルを作成し、環境変数を追加します：

```bash copy
touch .env
```

`.env` ファイルを編集し、環境変数を追加します：

```bash copy
OPENAI_API_KEY=<your-openai-api-key>
# その他の必要な環境変数を追加してください
```

### アプリケーションを構築する \{#build-the-application\}

```bash copy
npm run build
```

### アプリを実行する \{#run-the-application\}

```bash copy
node --import=./.mastra/output/instrumentation.mjs --env-file=".env" .mastra/output/index.mjs
```

:::note

Mastra アプリケーションはデフォルトでポート 4111 で動作します。リバースプロキシがこのポートにリクエストを転送するように設定されていることを確認してください。

:::

## Mastra サーバーに接続する \{#connect-to-your-mastra-server\}

`@mastra/client-js` パッケージの `MastraClient` を使用すると、クライアントアプリケーションから Mastra サーバーに接続できます。

詳しくは、[`MastraClient` のドキュメント](/docs/server-db/mastra-client)を参照してください。

```typescript copy showLineNumbers
import { MastraClient } from '@mastra/client-js';

const mastraClient = new MastraClient({
  baseUrl: 'https://<ドメイン名>',
});
```

## 次の手順 \{#next-steps\}

* [Mastra Client SDK](/docs/server-db/mastra-client)