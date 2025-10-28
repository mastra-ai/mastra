---
title: "Azure App Services"
description: "Mastra アプリを Azure App Services にデプロイする"
---

# Azure App Services \{#azure-app-services\}

Mastra アプリケーションを Azure App Services にデプロイします。

:::note

このガイドは、Mastra アプリケーションがデフォルトの
`npx create-mastra@latest` コマンドで作成されていることを前提としています。
新しく Mastra アプリケーションを作成する方法については、
[クイックスタートガイド](/docs/getting-started/installation)を参照してください。

:::

## 前提条件 \{#prerequisites\}

* 有効なサブスクリプションがある [Azure アカウント](https://azure.microsoft.com/)
* Mastra アプリケーションを含む [GitHub リポジトリ](https://github.com/)
* Mastra アプリケーションが `npx create-mastra@latest` を使用して作成されていること

## デプロイ手順 \{#deployment-steps\}

### 新しい App Service を作成する \{#create-a-new-app-service\}

* [Azure Portal](https://portal.azure.com) にサインインする
* **[App Services](https://docs.microsoft.com/en-us/azure/app-service/)** に移動するか、上部の検索バーで検索する
* 新しい App Service を作成するために **Create** をクリックする
* ドロップダウンで **Web App** を選択する

### App Service の設定を行う \{#configure-app-service-settings\}

* **Subscription**: 使用する Azure サブスクリプションを選択
* **Resource Group**: 新しいリソース グループを作成するか、既存のものを選択
* **Instance name**: アプリの一意な名前を入力（URL の一部になります）
* **Publish**: **Code** を選択
* **Runtime stack**: **Node 22 LTS** を選択
* **Operating System**: **Linux** を選択
* **Region**: ユーザーに近いリージョンを選択
* **Linux Plan**: 選択したリージョンによってはプランを選択できます。ニーズに合ったプランを選んでください。
* **Review + Create** をクリック
* 検証が完了したら **Create** をクリック

### デプロイの完了を待つ \{#wait-for-deployment\}

* デプロイが完了するまで待機する
* 完了したら、[次の手順] セクションの **Go to resource** をクリックする

### 環境変数の設定 \{#configure-environment-variables\}

デプロイを行う前に、環境変数を設定してください:

* 左サイドバーの **Settings** &gt; **Environment variables** に移動します
* 次のような必要な環境変数を追加します:
  * モデルプロバイダーの API キー（例: `OPENAI_API_KEY`）
  * データベース接続文字列
  * Mastra アプリケーションに必要なその他の設定値
* **Apply** をクリックして変更を保存します

### GitHub デプロイの設定 \{#set-up-github-deployment\}

* 左側のサイドバーで **Deployment Center** に移動します
* ソースとして **GitHub** を選択します
* まだ Azure で認証していない場合は GitHub にサインインします
* この例では、プロバイダーとして [GitHub Actions](https://docs.github.com/en/actions) を使用します
* 組織、リポジトリ、ブランチを選択します
* Azure が GitHub のワークフローファイルを生成し、続行前にプレビューできます
* **Save** をクリックします（保存ボタンはページ上部にあります）

### GitHub ワークフローを変更する \{#modify-the-github-workflow\}

:::warning

Azure が生成するデフォルトのワークフローは Mastra アプリケーションでは失敗するため、修正が必要です。

:::

Azure がワークフローを作成すると、GitHub Actions の実行がトリガーされ、ワークフローファイルがあなたのブランチにマージされます。必要な修正がないと失敗するため、最初の実行は必ずキャンセルしてください。

最新の変更をローカルリポジトリにプルし、生成されたワークフローファイル（`.github/workflows/main_<your-app-name>.yml`）を編集します:

1. **ビルドステップを更新**: &quot;npm install, build, and test&quot; という名前のステップを見つけ、以下を実施します:
   * ステップ名を &quot;npm install and build&quot; に変更する
   * Mastra アプリケーションで適切なテストを設定していない場合は、run セクションから `npm test` コマンドを削除してください。デフォルトのテストスクリプトは失敗し、デプロイを妨げます。動作するテストがある場合は、テストコマンドを残して構いません。

2. **zip アーティファクトのステップを更新**: &quot;Zip artifact for deployment&quot; ステップを見つけ、zip コマンドを次のものに置き換えます:

   ```yaml
   run: (cd .mastra/output && zip ../../release.zip -r .)
   ```

   これにより、`.mastra/output` のビルド成果物のみがデプロイパッケージに含まれるようになります。

### 変更をデプロイする \{#deploy-your-changes\}

* ワークフローの変更をコミットしてプッシュする
* ビルドは Azure ダッシュボードの **Deployment Center** で自動的に開始される
* デプロイが正常に完了するまで進行状況を監視する

### アプリケーションにアクセスする \{#access-your-application\}

* ビルドが成功したら、アプリケーションが起動するまでしばらく待ちます
* Azure ポータルの **Overview** タブに表示される既定の URL を使用して、デプロイ済みのアプリケーションにアクセスします
* アプリケーションは `https://<your-app-name>.azurewebsites.net` で利用できます

## Mastra サーバーに接続する \{#connect-to-your-mastra-server\}

`@mastra/client-js` パッケージの `MastraClient` を使って、クライアントアプリケーションから Mastra サーバーに接続できます。

詳しくは、[`MastraClient` のドキュメント](/docs/server-db/mastra-client)をご覧ください。

```typescript copy showLineNumbers
import { MastraClient } from '@mastra/client-js';

const mastraClient = new MastraClient({
  baseUrl: 'https://<your-app-name>.azurewebsites.net',
});
```

:::note

一部の料金プランでは、Azure App Service は一時的なファイルシステムを使用します。
本番環境のアプリケーションでは、ローカルファイルシステムに依存する Mastra のストレージプロバイダー（例：ファイル URL を使用する `LibSQLStore`）の利用は避け、
代わりにクラウドベースのストレージソリューションの使用を検討してください。

:::

## 次のステップ \{#next-steps\}

* [Mastra クライアント SDK](/docs/server-db/mastra-client)
* [カスタム ドメインの構成](https://docs.microsoft.com/en-us/azure/app-service/app-service-web-tutorial-custom-domain)
* [HTTPS の有効化](https://docs.microsoft.com/en-us/azure/app-service/configure-ssl-bindings)
* [Azure App Service のドキュメント](https://docs.microsoft.com/en-us/azure/app-service/)