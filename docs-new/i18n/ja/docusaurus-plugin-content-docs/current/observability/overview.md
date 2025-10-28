---
title: "概要"
description: Mastra のオブザーバビリティ機能で、アプリケーションの監視とデバッグを行います。
sidebar_position: 1
---

# 可観測性の概要 \{#observability-overview\}

Mastra は、AI アプリケーションに特化した包括的な可観測性機能を提供します。LLM の動作を監視し、エージェントの意思決定をトレースし、AI 特有のパターンを理解する専用ツールで複雑なワークフローをデバッグできます。

## 主要機能 \{#key-features\}

### 構造化ロギング \{#structured-logging\}

コンテキスト対応のロギングでアプリケーションをデバッグ:

* **コンテキスト伝搬**: トレースとの自動的な関連付け
* **設定可能なレベル**: 開発／本番で重大度に基づいてフィルタリング

### AI トレーシング \{#ai-tracing\}

AI オペレーションに特化したトレーシングで、以下を捕捉します:

* **LLM のやり取り**: トークン使用量、レイテンシ、プロンプト、生成結果
* **エージェント実行**: 意思決定の経路、ツール呼び出し、メモリ操作
* **ワークフローのステップ**: 分岐ロジック、並列実行、各ステップの出力
* **自動インストルメンテーション**: デコレータによる設定不要のトレーシング

### OTEL トレーシング \{#otel-tracing\}

OpenTelemetry を用いた従来型の分散トレーシング:

* **標準 OTLP プロトコル**: 既存のオブザーバビリティ基盤と互換
* **HTTP とデータベースのインストルメンテーション**: 一般的な操作に対するスパンを自動生成
* **プロバイダー連携**: Datadog、New Relic、Jaeger、およびその他の OTLP コレクター
* **分散コンテキスト**: W3C Trace Context の伝播

## クイックスタート \{#quick-start\}

Mastra インスタンスでオブザーバビリティを設定する:

```typescript filename="src/mastra/index.ts"
import { Mastra } from '@mastra/core';
import { PinoLogger } from '@mastra/core';
import { LibSqlStorage } from '@mastra/libsql';

export const mastra = new Mastra({
  // ... その他の設定
  logger: new PinoLogger(),
  observability: {
    default: { enabled: true }, // AIトレーシングを有効にする
  },
  storage: new LibSQLStore({
    url: 'file:./mastra.db', // トレーシングにはストレージが必要
  }),
  telemetry: {
    enabled: true, // OTELトレーシングを有効にする
  },
});
```

この基本セットアップにより、Playground と Mastra Cloud の両方でトレースとログを確認できます。

また、Langfuse や Braintrust、OpenTelemetry 互換のプラットフォーム（Datadog、New Relic、SigNoz など）など、各種外部トレーシングプロバイダーにも対応しています。詳しくは [AI Tracing](/docs/observability/ai-tracing/overview) のドキュメントをご覧ください。

## 次のステップ \{#whats-next\}

* **[AI トレーシングの設定](/docs/observability/ai-tracing/overview)**: アプリケーションのトレーシングを構成する
* **[ロギングの構成](/docs/observability/logging)**: 構造化ログを追加する
* **[サンプルを見る](/docs/examples/observability/basic-ai-tracing)**: オブザーバビリティを実際に確認する
* **[API リファレンス](/docs/reference/observability/ai-tracing)**: 詳細な構成オプション