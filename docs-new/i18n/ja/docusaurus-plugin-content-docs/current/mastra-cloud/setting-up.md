---
title: セットアップとデプロイ
description: Mastra Cloud プロジェクトの構成手順
sidebar_position: 2
---

# セットアップとデプロイ \{#setting-up-and-deploying\}

このページでは、GitHub 連携による自動デプロイを使って、[Mastra Cloud](https://mastra.ai/cloud) 上にプロジェクトをセットアップする方法を説明します。

:::tip Mastra Cloud

Mastra アプリケーションを [Mastra Cloud](https://mastra.ai/cloud) にデプロイして、自動デプロイ、監視、管理を自動化しましょう。

:::

## 前提条件 \{#prerequisites\}

* [Mastra Cloud](https://mastra.ai/cloud) のアカウント
* Mastra アプリケーションを含む GitHub アカウント／リポジトリ

> 既定の設定で新しい Mastra プロジェクトの雛形を作成する方法は、[はじめに](/docs/getting-started/installation) ガイドをご覧ください。

## セットアップとデプロイのプロセス \{#setup-and-deploy-process\}

### Mastra Cloud にサインイン \{#sign-in-to-mastra-cloud\}

[https://cloud.mastra.ai/](https://cloud.mastra.ai) にアクセスし、次のいずれかでサインインしてください:

* **GitHub**
* **Google**

### Mastra GitHub アプリをインストールする \{#install-the-mastra-github-app\}

案内が表示されたら、Mastra GitHub アプリをインストールしてください。

![GitHub をインストール](/img/mastra-cloud/mastra-cloud-install-github.jpg)

### 新規プロジェクトの作成 \{#create-a-new-project\}

新しいプロジェクトを作成するには、**Create new project** ボタンをクリックします。

![Create new project](/img/mastra-cloud/mastra-cloud-create-new-project.jpg)

### Git リポジトリをインポートする \{#import-a-git-repository\}

リポジトリを検索して、**Import** をクリックします。

![Import Git repository](/img/mastra-cloud/mastra-cloud-import-git-repository.jpg)

### デプロイの設定 \{#configure-the-deployment\}

Mastra Cloud は最適なビルド設定を自動検出しますが、以下のオプションでカスタマイズできます。

![Deployment details](/img/mastra-cloud/mastra-cloud-deployment-details.jpg)

* **GitHub からのインポート**: GitHub リポジトリ名
* **プロジェクト名**: プロジェクト名をカスタマイズ
* **ブランチ**: デプロイ元のブランチ
* **プロジェクトルート**: プロジェクトのルートディレクトリ
* **Mastra ディレクトリ**: Mastra ファイルの場所
* **環境変数**: アプリケーションで使用する環境変数を追加
* **Build と Store の設定**:
  * **インストールコマンド**: ビルド前にプロジェクトの依存関係をインストール
  * **プロジェクトセットアップコマンド**: ビルド前に外部依存関係を準備
  * **ポート**: サーバーが使用するネットワークポート
  * **Store 設定**: Mastra Cloud 組み込みの [LibSQLStore](/docs/server-db/storage) ストレージを使用
* **プロジェクトをデプロイ**: デプロイを開始

### プロジェクトをデプロイ \{#deploy-project\}

設定した構成に基づいてアプリケーションを作成してデプロイするには、**Deploy Project** をクリックします。

## デプロイが成功しました \{#successful-deployment\}

デプロイが完了すると、プロジェクトのステータス、ドメイン、最新のデプロイ、接続済みのエージェントとワークフローを確認できる**Overview**画面が表示されます。

![デプロイ成功](/img/mastra-cloud/mastra-cloud-successful-deployment.jpg)

## 継続的インテグレーション \{#continuous-integration\}

このプロジェクトでは、GitHub リポジトリの指定ブランチにプッシュするたびに自動デプロイが実行されるよう構成されています。

## アプリケーションのテスト \{#testing-your-application\}

デプロイに成功したら、Mastra Cloud の [Playground](/docs/mastra-cloud/dashboard#playground) からエージェントやワークフローをテストするか、[Client SDK](/docs/server-db/mastra-client) を使ってそれらとやり取りできます。

## 次のステップ \{#next-steps\}

* [ダッシュボードの使い方](/docs/mastra-cloud/dashboard)