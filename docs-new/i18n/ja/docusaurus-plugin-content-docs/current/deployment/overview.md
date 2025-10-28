---
title: 概要
description: Mastra アプリケーションのさまざまなデプロイ方法について学ぶ
sidebar_position: 1
---

# デプロイ概要 \{#deployment-overview\}

Mastra では、フルマネージドのソリューションからセルフホスト、Web フレームワーク連携まで、アプリケーションの要件に合わせた複数のデプロイ方法を提供しています。本ガイドでは、利用可能なデプロイ手段を理解し、プロジェクトに最適な選択ができるよう支援します。

## デプロイ方法 \{#deployment-options\}

### ランタイムのサポート \{#runtime-support\}

* Node.js `v20.0` 以上
* Bun
* Deno
* [Cloudflare](../deployment/serverless-platforms/cloudflare-deployer)

### Mastra Cloud \{#mastra-cloud\}

Mastra Cloudは、GitHubリポジトリと連携し、コードの変更を検知して自動デプロイを行い、監視ツールも提供するデプロイプラットフォームです。主な機能は以下のとおりです。

* GitHubリポジトリ連携
* git pushに応じたデプロイ
* エージェントのテスト用インターフェース
* 充実したログとトレース
* プロジェクトごとのカスタムドメイン

[Mastra Cloud のドキュメントを見る →](../mastra-cloud/overview)

### Webフレームワークで利用する \{#with-a-web-framework\}

MastraはさまざまなWebフレームワークに統合できます。詳しくは、以下のいずれかのガイドをご覧ください。

* [Next.jsでの利用](../frameworks/web-frameworks/next-js)
* [Astroでの利用](../frameworks/web-frameworks/astro)

フレームワークと統合している場合、Mastraは通常、デプロイのための追加の設定は不要です。

[Webフレームワークとの統合を見る →](./web-framework)

### サーバー利用 \{#with-a-server\}

Mastra は標準的な Node.js の HTTP サーバーとしてデプロイでき、インフラやデプロイ環境を自由にコントロールできます。

* カスタム API ルートとミドルウェア
* CORS や認証の柔軟な設定
* VM、コンテナ、PaaS へのデプロイ
* 既存の Node.js アプリケーションとの統合に最適

[サーバーのデプロイガイド →](./server-deployment)

### サーバーレスプラットフォーム \{#serverless-platforms\}

Mastra は主要なサーバーレスプラットフォーム向けの専用デプロイヤーを提供しており、最小限の設定でアプリケーションをデプロイできます。

* Cloudflare Workers、Vercel、Netlify へのデプロイ
* プラットフォームごとの最適化
* デプロイの簡素化
* プラットフォームによる自動スケーリング

[サーバーレス配備ガイド →](./server-deployment)

## クライアント構成 \{#client-configuration\}

Mastra アプリケーションをデプロイしたら、クライアントがそれと通信できるように設定する必要があります。Mastra Client SDK は、Mastra サーバーとやり取りするためのシンプルで型安全なインターフェースを提供します。

* 型安全な API 操作
* 認証とリクエスト処理
* リトライおよびエラー処理
* ストリーミングレスポンス対応

[クライアント構成ガイド →](../server-db/mastra-client)

## デプロイオプションの選び方 \{#choosing-a-deployment-option\}

| オプション              | 最適な対象                                                     | 主な利点                                                             |
| ------------------------ | ------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Mastra Cloud**         | インフラを気にせず素早くリリースしたいチーム                   | フルマネージド、自動スケーリング、組み込みの可観測性                 |
| **Framework Deployment** | 既に Next.js や Astro などを利用しているチーム                | フロントエンドとバックエンドを統合した単一コードベースでデプロイを簡素化 |
| **Server Deployment**    | 最大限の制御とカスタマイズが必要なチーム                       | 完全な制御、カスタムミドルウェア、既存アプリとの統合                 |
| **Serverless Platforms** | 既に Vercel、Netlify、または Cloudflare を利用しているチーム   | プラットフォーム連携、簡易なデプロイ、自動スケーリング               |