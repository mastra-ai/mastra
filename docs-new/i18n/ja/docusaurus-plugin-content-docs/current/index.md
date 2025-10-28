---
sidebar_position: 1
title: はじめに
description: Mastra は TypeScript 製のエージェントフレームワークです。AI アプリケーションや機能をすばやく構築するのに役立ちます。ワークフロー、エージェント、RAG、インテグレーション、同期、評価といった必要なプリミティブを一式提供します。
---

import YouTube from "@site/src/components/YouTube";

# Mastra について \{#about-mastra\}

Gatsby を手がけたチームによる Mastra は、モダンな TypeScript スタックで AI 搭載のアプリケーションやエージェントを構築するためのフレームワークです。

初期のプロトタイプから本番運用のアプリケーションまでに必要なものをすべて備えています。Mastra は React、Next.js、Node などのフロントエンド／バックエンドフレームワークと統合でき、スタンドアロンのサーバーとしてどこにでもデプロイ可能です。信頼性の高い AI プロダクトを構築・チューニング・スケールするための、最も簡単な方法です。

<YouTube id="8o_Ejbcw5s8" />

## なぜ Mastra なのか？ \{#why-mastra\}

TypeScript に特化し、確立された AI パターンに基づいて設計された Mastra は、優れた AI アプリケーションをすぐに構築できるように、必要な機能をすべて提供します。

主な特長:

* [**Model routing**](/docs/models) - 1 つの標準インターフェースで 40 以上のプロバイダーに接続。OpenAI、Anthropic、Gemini などのモデルを利用できます。

* [**Agents**](/docs/agents/overview) - LLM とツールを使ってオープンエンドなタスクを解決する自律型エージェントを構築。エージェントは目標に基づいて推論し、使用するツールを選択し、モデルが最終回答を出すか、任意の停止条件に達するまで内部で反復します。

* [**Workflows**](/docs/workflows/overview) - 実行を明示的に制御したい場合は、Mastra のグラフベースのワークフローエンジンで複雑なマルチステップ処理をオーケストレーション。Mastra のワークフローは制御フローに直感的な構文（`.then()`、`.branch()`、`.parallel()`）を採用しています。

* [**Human-in-the-loop**](/docs/workflows/suspend-and-resume) - エージェントやワークフローを一時停止し、再開前にユーザー入力や承認を待機可能。Mastra は[storage](/docs/server-db/storage)で実行状態を保持するため、無期限に一時停止しても中断地点から再開できます。

* **コンテキスト管理** - 必要なタイミングでエージェントに適切なコンテキストを付与。[conversation history](/docs/memory/conversation-history) を提供し、ソース（API、データベース、ファイル）からデータを [retrieve](/docs/rag/overview) し、人間らしい [working](/docs/memory/working-memory) メモリや [semantic](/docs/memory/semantic-recall) メモリを追加して、エージェントの一貫した振る舞いを実現します。

* **統合** - 既存の React、Next.js、Node.js アプリにエージェントやワークフローを組み込む、またはスタンドアロンのエンドポイントとして提供可能。UI 構築時は、Vercel の AI SDK UI や CopilotKit などのエージェント指向ライブラリと統合して、Web 上で AI アシスタントを具現化できます。

* **本番運用に必須の機能** - 信頼性の高いエージェントを運用するには、継続的なインサイト、評価、反復が不可欠。組み込みの [evals](/docs/scorers/evals/overview) と [observability](/docs/observability/overview) により、Mastra は観測・計測・改善を継続的に行うためのツールを提供します。

## 何が構築できますか？ \{#what-can-you-build\}

* 言語理解・推論・アクションを組み合わせて、現実の課題を解決するAI搭載アプリケーション。

* カスタマーサポート、オンボーディング、社内問い合わせ向けの対話型エージェント。

* コーディング、法務、ファイナンス、リサーチ、クリエイティブ業務向けのドメイン特化型コパイロット。

* トリガー、ルーティング、実行までを行う多段階のワークフロー自動化。

* データを分析し、実行可能な推奨事項を提示する意思決定支援ツール。

実際の活用例は[ケーススタディ](https://mastra.ai/blog/category/case-studies)や[コミュニティショーケース](/showcase)をご覧ください。

## はじめに \{#get-started\}

CLI または手動インストールで順を追ってセットアップするには、[インストールガイド](/docs/getting-started/installation)をご覧ください。

AI エージェントが初めての方は、[テンプレート](/docs/getting-started/templates)、[コース](https://mastra.ai/course)、[YouTube チャンネル](https://youtube.com/@mastra-ai)をチェックして、今日から Mastra での開発を始めましょう。

皆さんがどんなものを作るのか、楽しみにしています ✌️