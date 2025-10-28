---
title: ダッシュボード
description: Mastra Cloudで利用できる各機能の詳細
sidebar_position: 3
---

# ダッシュボードの操作方法 \{#navigating-the-dashboard\}

このページでは、Mastra Cloud ダッシュボードの使い方を説明します。プロジェクトの設定、デプロイの詳細の確認、組み込みの[Playground](/docs/mastra-cloud/dashboard#playground)を使ったエージェントやワークフローとの対話が行えます。

:::tip Mastra Cloud

自動デプロイ、監視、管理のために、Mastra アプリケーションを [Mastra Cloud](https://mastra.ai/cloud) にデプロイしましょう。

:::

## 概要 \{#overview\}

「概要」ページでは、アプリケーションのドメインURL、ステータス、最新のデプロイ、接続中のエージェントやワークフローなどの詳細を確認できます。

![Project dashboard](/img/mastra-cloud/mastra-cloud-project-dashboard.jpg)

主な機能:

各プロジェクトには、現在のデプロイ状況、アクティブなドメイン、環境変数が表示され、アプリケーションの稼働状況をすばやく把握できます。

## デプロイメント \{#deployments\}

「Deployments」ページでは、最新のビルドが表示され、詳細なビルドログへすばやくアクセスできます。任意の行をクリックすると、特定のデプロイメントの詳細情報を確認できます。

![Dashboard deployment](/img/mastra-cloud/mastra-cloud-dashboard-deployments.jpg)

主な機能:

各デプロイメントには、現在のステータス、デプロイ元の Git ブランチ、そしてコミットハッシュから生成されたタイトルが含まれます。

## Logs \{#logs\}

**Logs** ページでは、本番環境でのアプリケーションの動作をデバッグ・監視するための詳細な情報を確認できます。

![Dashboard logs](/img/mastra-cloud/mastra-cloud-dashboard-logs.jpg)

主な機能:

各ログには重大度レベルが付与されており、エージェント、ワークフロー、ストレージのアクティビティを示す詳細なメッセージが表示されます。

## 設定 \{#settings\}

「Settings」ページでは、アプリケーションの設定を変更できます。

![Dashboard settings](/img/mastra-cloud/mastra-cloud-dashboard-settings.jpg)

主な機能:

環境変数の管理、名前やブランチといった主要なプロジェクト設定の編集、LibSQLStore を使ったストレージの設定、エンドポイントの安定した URL の指定が可能です。

> 変更を反映させるには、再デプロイが必要です。

## プレイグラウンド \{#playground\}

### エージェント \{#agents\}

「エージェント」ページでは、アプリケーションで使用しているすべてのエージェントを確認できます。任意のエージェントをクリックすると、チャットインターフェースでやり取りできます。

![Dashboard playground agents](/img/mastra-cloud/mastra-cloud-dashboard-playground-agents.jpg)

主な機能:

チャットインターフェースでエージェントをリアルタイムにテストし、各やり取りのトレースを確認し、すべての応答に対する評価スコアを閲覧できます。

### ワークフロー \{#workflows\}

**Workflows** ページでは、アプリケーションで使用されているすべてのワークフローが表示されます。任意のワークフローをクリックすると、ランナーインターフェースで操作できます。

![Dashboard playground workflows](/img/mastra-cloud/mastra-cloud-dashboard-playground-workflows.jpg)

主な機能:

ステップごとのグラフでワークフローを可視化し、実行トレースを確認し、内蔵ランナーでワークフローを直接実行できます。

### ツール \{#tools\}

「ツール」ページでは、エージェントが使用しているすべてのツールを確認できます。任意のツールをクリックすると、入力インターフェースから操作できます。

![Dashboard playground tools](/img/mastra-cloud/mastra-cloud-dashboard-playground-tools.jpg)

主な機能:

スキーマに合致する入力を与え、構造化された出力を確認して、ツールをテストできます。

## MCP サーバー \{#mcp-servers\}

「MCP サーバー」ページには、アプリケーションに含まれるすべての MCP サーバーが一覧表示されます。詳細を見るには、任意の MCP サーバーをクリックしてください。

![Dashboard playground mcp servers](/img/mastra-cloud/mastra-cloud-dashboard-playground-mcpservers.jpg)

主な機能:

各 MCP サーバーには、HTTP および SSE の API エンドポイントに加え、Cursor や Windsurf などのツール向け IDE 設定スニペットが用意されています。

## 次のステップ \{#next-steps\}

* [トレーシングとログを理解する](/docs/mastra-cloud/observability)