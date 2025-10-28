---
title: "リファレンス: Arize AX 統合"
description: Mastra への Arize AX 統合に関するドキュメント。LLM アプリケーションの監視と評価を行う、包括的な AI オブザーバビリティプラットフォームです。
---

# Arize AX \{#arize-ax\}

Arize AX は、本番環境での LLM アプリケーションの監視・評価・改善に特化して設計された、包括的な AI 可観測性プラットフォームです。

## 設定 \{#configuration\}

Mastra で Arize AX を利用するには、環境変数を使用するか、Mastra の設定で直接構成できます。

### 環境変数の使用 \{#using-environment-variables\}

次の環境変数を設定してください:

```env
ARIZE_SPACE_ID="スペースID"
ARIZE_API_KEY="APIキー"
```

### 資格情報の取得 \{#getting-your-credentials\}

1. [app.arize.com](https://app.arize.com) で Arize AX アカウントに登録します
2. スペース設定に移動し、Space ID と API キーを確認します

## インストール \{#installation\}

まず、Mastra 用の OpenInference のインスツルメンテーションパッケージをインストールします:

```bash
npm install @arizeai/openinference-mastra
```

## 実装 \{#implementation\}

OpenTelemetry と併用して Arize AX を使うように Mastra を設定する手順は次のとおりです：

```typescript
import { Mastra } from '@mastra/core';
import { isOpenInferenceSpan, OpenInferenceOTLPTraceExporter } from '@arizeai/openinference-mastra';

export const mastra = new Mastra({
  // ... そのほかの設定
  telemetry: {
    serviceName: 'your-mastra-app',
    enabled: true,
    export: {
      type: 'custom',
      exporter: new OpenInferenceOTLPTraceExporter({
        url: 'https://otlp.arize.com/v1/traces',
        headers: {
          space_id: process.env.ARIZE_SPACE_ID!,
          api_key: process.env.ARIZE_API_KEY!,
        },
        spanFilter: isOpenInferenceSpan,
      }),
    },
  },
});
```

## 自動トレースされる内容 \{#what-gets-automatically-traced\}

Mastra の包括的なトレースでは、次の項目を記録します:

* **エージェントの操作**: すべてのエージェントによる生成、ストリーミング、対話呼び出し
* **LLM とのやり取り**: 入出力メッセージとメタデータを含む完全なモデル呼び出し
* **ツール実行**: エージェントによる、パラメータと結果を伴う関数呼び出し
* **ワークフロー実行**: タイミングや依存関係を含むステップごとの実行
* **メモリ操作**: エージェントメモリのクエリ、更新、取得

すべてのトレースは OpenTelemetry の標準に準拠しており、モデルパラメータ、トークン使用量、実行時間、エラー詳細などの関連メタデータを含みます。

## ダッシュボード \{#dashboard\}

設定が完了すると、[app.arize.com](https://app.arize.com) の Arize AX ダッシュボードでトレースと分析情報を確認できます