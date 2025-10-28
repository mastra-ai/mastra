---
title: "リファレンス: Arize Phoenix 統合"
description: オープンソースのAI可観測性プラットフォームである Mastra と Arize Phoenix を統合し、LLM アプリケーションを監視・評価するためのドキュメント。
---

# Arize Phoenix \{#arize-phoenix\}

Arize Phoenixは、LLMアプリケーションの監視・評価・改善に特化した、オープンソースのAIオブザーバビリティプラットフォームです。セルフホストで利用することも、Phoenix Cloud経由で利用することもできます。

## 設定 \{#configuration\}

### Phoenix Cloud \{#phoenix-cloud\}

Phoenix Cloud を利用している場合は、次の環境変数を設定してください:

```env
PHOENIX_API_KEY="your-phoenix-api-key"
PHOENIX_COLLECTOR_ENDPOINT="your-phoenix-hostname"
```

#### 資格情報の取得 \{#getting-your-credentials\}

1. [app.phoenix.arize.com](https://app.phoenix.arize.com/login) で Arize Phoenix のアカウントに登録する
2. 左側のバーの「Keys」から API キーを取得する
3. コレクターのエンドポイント用に Phoenix のホスト名を控える

### 自前でホストする Phoenix \{#self-hosted-phoenix\}

自前でホストしている Phoenix インスタンスでは、次の設定を行ってください：

```env
PHOENIX_COLLECTOR_ENDPOINT="http://localhost:6006"
# オプション: 認証が有効化されている場合
PHOENIX_API_KEY="your-api-key"
```

## インストール \{#installation\}

必要なパッケージをインストールします:

```bash
npm install @arizeai/openinference-mastra@^2.2.0
```

## 実装 \{#implementation\}

Mastra を Phoenix と OpenTelemetry で利用するための設定方法は次のとおりです。

### Phoenix Cloud の設定 \{#phoenix-cloud-configuration\}

```typescript
import { Mastra } from '@mastra/core';
import { OpenInferenceOTLPTraceExporter, isOpenInferenceSpan } from '@arizeai/openinference-mastra';

export const mastra = new Mastra({
  // ... その他の設定
  telemetry: {
    serviceName: 'my-mastra-app',
    enabled: true,
    export: {
      type: 'custom',
      exporter: new OpenInferenceOTLPTraceExporter({
        url: process.env.PHOENIX_COLLECTOR_ENDPOINT!,
        headers: {
          Authorization: `Bearer ${process.env.PHOENIX_API_KEY}`,
        },
        spanFilter: isOpenInferenceSpan,
      }),
    },
  },
});
```

### セルフホスト版 Phoenix の設定 \{#self-hosted-phoenix-configuration\}

```typescript
import { Mastra } from '@mastra/core';
import { OpenInferenceOTLPTraceExporter, isOpenInferenceSpan } from '@arizeai/openinference-mastra';

export const mastra = new Mastra({
  // ... その他の設定
  telemetry: {
    serviceName: 'my-mastra-app',
    enabled: true,
    export: {
      type: 'custom',
      exporter: new OpenInferenceOTLPTraceExporter({
        url: process.env.PHOENIX_COLLECTOR_ENDPOINT!,
        spanFilter: isOpenInferenceSpan,
      }),
    },
  },
});
```

## 自動トレースの対象 \{#what-gets-automatically-traced\}

Mastra の包括的なトレーシングでは、以下を記録します:

* **エージェントの動作**: エージェントの生成、ストリーミング、インタラクション呼び出しのすべて
* **LLM とのやり取り**: 入出力メッセージやメタデータを含む完全なモデル呼び出し
* **ツール実行**: エージェントによる関数呼び出し（パラメータと結果を含む）
* **ワークフロー実行**: タイミングや依存関係を含むステップごとのワークフロー実行
* **メモリ操作**: エージェントのメモリに対するクエリ、更新、取得

すべてのトレースは OpenTelemetry の標準に準拠し、モデルのパラメータ、トークン使用量、実行時間、エラー詳細などの関連メタデータを含みます。

## ダッシュボード \{#dashboard\}

設定後は、Phoenix でトレースや分析を確認できます：

* **Phoenix Cloud**: [app.phoenix.arize.com](https://app.phoenix.arize.com)
* **セルフホスト**: Phoenix インスタンスの URL（例：`http://localhost:6006`）

セルフホストの選択肢については、[Phoenix のセルフホスティングに関するドキュメント](https://arize.com/docs/phoenix/self-hosting)をご覧ください。