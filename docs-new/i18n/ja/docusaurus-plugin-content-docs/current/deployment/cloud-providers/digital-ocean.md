---
title: "DigitalOcean"
description: "Mastra アプリケーションを DigitalOcean にデプロイする"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# DigitalOcean \{#digital-ocean\}

Mastra アプリケーションを DigitalOcean の App Platform と Droplet にデプロイします。

:::note

このガイドは、Mastra アプリケーションがデフォルトの
`npx create-mastra@latest` コマンドで作成されていることを前提としています。
新しい Mastra アプリケーションの作成方法については、
[はじめに](./../../getting-started/installation)をご覧ください。

:::

<Tabs>
  <TabItem value="アプリ プラットフォーム" label="アプリプラットフォーム">
    ## App Platform \{#app-platform\}

    ### 前提条件 [#app-platform-prerequisites]

    * Mastra アプリケーションを含む Git リポジトリ。[GitHub](https://github.com/) リポジトリ、[GitLab](https://gitlab.com/) リポジトリ、またはその他の互換性のあるソースプロバイダーを利用できます。
    * [DigitalOcean アカウント](https://www.digitalocean.com/)

    ### デプロイ手順 \{#deployment-steps\}

    ### 新しいアプリを作成 \{#create-a-new-app\}

    * [DigitalOcean ダッシュボード](https://cloud.digitalocean.com/) にログインします。
    * [App Platform](https://docs.digitalocean.com/products/app-platform/) サービスに移動します。
    * ソースプロバイダーを選択し、新しいアプリを作成します。

    ### デプロイ元の設定 \{#configure-deployment-source\}

    * リポジトリを接続して選択します。コンテナイメージやサンプルアプリを選ぶこともできます。
    * デプロイ元とするブランチを選択します。
    * 必要に応じてソースディレクトリを設定します。Mastra アプリケーションがデフォルトのディレクトリ構造を使用している場合は、ここでの操作は不要です。
    * 次のステップに進みます。

    ### リソース設定と環境変数の構成 \{#configure-resource-settings-and-environment-variables\}

    * Node.js のビルドは自動的に検出されます。
    * **ビルドコマンドの設定**: App Platform が Mastra プロジェクトを正しくビルドできるよう、カスタムのビルドコマンドを追加する必要があります。パッケージマネージャに応じて以下を設定してください:

    <Tabs>
      <TabItem value="npm" label="npm">
        ```
        npm run build
        ```
      </TabItem>

      <TabItem value="pnpm" label="pnpm">
        ```
        pnpm build
        ```
      </TabItem>

      <TabItem value="yarn" label="yarn">
        ```
        yarn build
        ```
      </TabItem>

      <TabItem value="bun" label="bun">
        ```
        bun run build
        ```
      </TabItem>
    </Tabs>

    * Mastra アプリケーションに必要な環境変数を追加します。API キー、データベース URL、その他の設定値などが含まれます。
    * ここでリソースのサイズを設定することもできます。
    * 任意で設定できるその他の項目として、リソースのリージョン、アプリの一意の名前、リソースが属するプロジェクトなどがあります。
    * 設定と料金見積もりを確認したうえで、完了したらアプリを作成します。

    ### デプロイ \{#deployment\}

    * アプリは自動的にビルドおよびデプロイされます。
    * DigitalOcean から、デプロイ済みアプリケーションにアクセスするための URL が提供されます。

    これで、DigitalOcean が提供する URL からデプロイ済みアプリケーションにアクセスできます。

    :::note

    DigitalOcean App Platform は揮発性のファイルシステムを使用しており、
    ファイルシステムに書き込まれたファイルは短期間で消失する可能性があります。
    ファイルシステムを使用する Mastra のストレージプロバイダーの利用は避けてください。
    たとえば、ファイル URL を使用する `LibSQLStore` などです。

    :::
  </TabItem>

  <TabItem value="滴" label="Droplets">
    ## Droplets \{#droplets\}

    DigitalOcean の Droplets に Mastra アプリケーションをデプロイします。

    ### 前提条件 [#droplets-prerequisites]

    * [DigitalOcean アカウント](https://www.digitalocean.com/)
    * Ubuntu 24 以上で稼働する [Droplet](https://docs.digitalocean.com/products/droplets/)
    * ドメイン名（A レコードが Droplet を指していること）
    * リバースプロキシの設定（例: [nginx](https://nginx.org/) の使用）
    * SSL 証明書の設定（例: [Let&#39;s Encrypt](https://letsencrypt.org/) の使用）
    * Droplet に Node.js 18 以上がインストール済み

    ### デプロイ手順 \{#deployment-steps\}

    ### Mastra アプリケーションをクローンする \{#clone-your-mastra-application\}

    Droplet に接続し、リポジトリをクローンします:

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

    リポジトリのディレクトリに移動します:

    ```bash copy
    cd "<your-repository>"
    ```

    ### 依存関係をインストール \{#install-dependencies\}

    ```bash copy
    npm install
    ```

    ### 環境変数を設定する \{#set-up-environment-variables\}

    `.env` ファイルを作成し、環境変数を追加します:

    ```bash copy
    touch .env
    ```

    `.env` ファイルを編集して、環境変数を追加します:

    ```bash copy
    OPENAI_API_KEY=<your-openai-api-key>
    # 他の必要な環境変数を追加してください
    ```

    ### アプリをビルドする \{#build-the-application\}

    ```bash copy
    npm run build
    ```

    ### アプリを実行する \{#run-the-application\}

    ```bash copy
    node --import=./.mastra/output/instrumentation.mjs --env-file=".env" .mastra/output/index.mjs
    ```

    :::note

    Mastra アプリケーションはデフォルトでポート 4111 で動作します。リバースプロキシがこのポートにリクエストを転送するよう設定されていることを確認してください。

    :::
  </TabItem>
</Tabs>

## Mastra サーバーに接続する \{#connect-to-your-mastra-server\}

`@mastra/client-js` パッケージの `MastraClient` を使って、クライアントアプリケーションから Mastra サーバーに接続できます。

詳しくは、[`MastraClient` のドキュメント](/docs/server-db/mastra-client)をご覧ください。

```typescript copy showLineNumbers
import { MastraClient } from '@mastra/client-js';

const mastraClient = new MastraClient({
  baseUrl: 'https://<ドメイン名>',
});
```

## 次のステップ \{#next-steps\}

* [Mastra クライアント SDK](/docs/server-db/mastra-client)
* [DigitalOcean App Platform ドキュメント](https://docs.digitalocean.com/products/app-platform/)
* [DigitalOcean Droplets ドキュメント](https://docs.digitalocean.com/products/droplets/)