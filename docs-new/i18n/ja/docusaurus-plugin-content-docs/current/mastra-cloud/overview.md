---
title: 概要
description: Mastra アプリケーション向けのデプロイおよび監視サービス
sidebar_position: 1
---

# Mastra Cloud \{#mastra-cloud\}

[Mastra Cloud](https://mastra.ai/cloud) は、Mastra アプリケーションのデプロイ、管理、監視、デバッグを行うためのプラットフォームです。アプリケーションを[デプロイ](/docs/mastra-cloud/setting-up)すると、Mastra Cloud はエージェント、ツール、ワークフローを REST API エンドポイントとして公開します。

:::tip Mastra Cloud

自動デプロイ、監視、管理のために、Mastra アプリケーションを [Mastra Cloud](https://mastra.ai/cloud) にデプロイしましょう。

:::

## プラットフォーム機能 \{#platform-features\}

自動ビルド、整理されたプロジェクト、追加設定不要で、アプリケーションのデプロイと管理を実現します。

![Platform features](/img/mastra-cloud/mastra-cloud-platform-features.jpg)

主な機能:

Mastra Cloud はゼロコンフィグのデプロイ、GitHub との継続的インテグレーション、エージェント・ツール・ワークフローを一体でパッケージ化するアトミックデプロイをサポートします。

## プロジェクト ダッシュボード \{#project-dashboard\}

詳細な出力ログ、デプロイ状況、インタラクティブなツールで、アプリケーションの監視とデバッグを行えます。

![Project dashboard](/img/mastra-cloud/mastra-cloud-project-dashboard.jpg)

主な機能:

プロジェクト ダッシュボードは、アプリケーションのステータスやデプロイ状況の全体像を把握できるほか、ログへのアクセスやエージェント／ワークフローをテストするための組み込みプレイグラウンドも提供します。

## プロジェクト構成 \{#project-structure\}

正しく検出・デプロイできるよう、標準的な Mastra のプロジェクト構成を使用してください。

> ファイル構成の情報は利用可能です。詳細なツリー表示は元のドキュメントをご参照ください。

Mastra Cloud はリポジトリをスキャンして次の要素を検出します:

* **Agents**: `new Agent({...})` で定義
* **Tools**: `createTool({...})` で定義
* **Workflows**: `createWorkflow({...})` で定義
* **Steps**: `createStep({...})` で定義
* **Environment Variables**: API キーおよび構成変数

## 技術的な実装 \{#technical-implementation\}

Mastra Cloud は、Mastra のエージェント、ツール、ワークフロー向けに特化して設計されています。長時間にわたるリクエストを処理し、各実行の詳細なトレースを記録でき、Evals の組み込みサポートも備えています。

## 次のステップ \{#next-steps\}

* [設定とデプロイ](/docs/mastra-cloud/setting-up)