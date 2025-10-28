---
title: "クラウドエクスポーター"
description: "本番監視のためにトレースを Mastra Cloud に送信する"
---

# クラウドエクスポーター \{#cloud-exporter\}

`CloudExporter` はトレースを Mastra Cloud に送信し、監視の一元化とチームでの共同作業を実現します。デフォルトのオブザーバビリティ設定を有効なアクセストークンとともに使用している場合は、自動的に有効になります。

## CloudExporter を使うタイミング \{#when-to-use-cloudexporter\}

CloudExporter は次の用途に最適です:

* **本番監視** - トレースを一元的に可視化
* **チームの共同作業** - 組織全体でトレースを共有
* **高度な分析** - インサイトとパフォーマンス指標の可視化
* **メンテナンス不要** - インフラの運用管理は不要

## 設定 \{#configuration\}

### 前提条件 \{#prerequisites\}

1. **Mastra Cloud アカウント**： [cloud.mastra.ai](https://cloud.mastra.ai) で登録
2. **アクセストークン**： Mastra Cloud → Settings → API Tokens で生成
3. **環境変数**： 資格情報を設定：

```bash filename=".env"
MASTRA_CLOUD_ACCESS_TOKEN=mst_xxxxxxxxxxxxxxxx
```

### 基本的な設定 \{#basic-setup\}

```typescript filename="src/mastra/index.ts"
import { Mastra } from '@mastra/core';
import { CloudExporter } from '@mastra/core/ai-tracing';

export const mastra = new Mastra({
  observability: {
    configs: {
      production: {
        serviceName: 'my-service',
        exporters: [
          new CloudExporter(), // MASTRA_CLOUD_ACCESS_TOKEN 環境変数を使用します
        ],
      },
    },
  },
});
```

### 自動構成 \{#automatic-configuration\}

デフォルトのオブザーバビリティ構成を使用している場合、アクセス トークンが設定されていれば CloudExporter は自動的に組み込まれます。

```typescript
export const mastra = new Mastra({
  observability: {
    default: { enabled: true }, // トークンが存在する場合、CloudExporterが自動的に含まれます
  },
});
```

### すべての設定 \{#complete-configuration\}

```typescript
new CloudExporter({
  // オプション - デフォルトは環境変数
  accessToken: process.env.MASTRA_CLOUD_ACCESS_TOKEN,

  // オプション - セルフホスト版Mastra Cloud用
  endpoint: 'https://cloud.your-domain.com',

  // バッチ処理の設定
  maxBatchSize: 1000, // バッチあたりの最大スパン数
  maxBatchWaitMs: 5000, // バッチ送信前の最大待機時間

  // 診断ログ
  logLevel: 'info', // debug | info | warn | error
});
```

## トレースの閲覧 \{#viewing-traces\}

### Mastra Cloud ダッシュボード \{#mastra-cloud-dashboard\}

1. [cloud.mastra.ai](https://cloud.mastra.ai) にアクセスします
2. プロジェクトを選択します
3. Observability → Traces に移動します
4. フィルターを使って特定のトレースを絞り込みます:
   * Service name
   * Time range
   * Trace ID
   * Error status

### 機能 \{#features\}

* **トレース タイムライン** - 実行フローの可視化
* **スパンの詳細** - 入力、出力、メタデータ
* **パフォーマンス指標** - レイテンシー、トークン使用量
* **チームでの共同作業** - トレースリンクの共有

## パフォーマンス \{#performance\}

:::note パフォーマンス最適化

CloudExporter はネットワークの利用効率を高めるため、インテリジェントなバッチ処理を採用しています。トレースはバッファリングされ、まとめて送信されるため、オーバーヘッドを抑えつつ、ほぼリアルタイムの可視性を維持します。

:::

### バッチ処理の動作 \{#batching-behavior\}

* トレースは `maxBatchSize`（デフォルト: 1000）までまとめてバッチ化されます
* バッチは満杯になるか、`maxBatchWaitMs`（デフォルト: 5秒）経過後に送信されます
* 失敗したバッチは指数バックオフで再試行されます
* Mastra Cloud に接続できない場合は、優雅な劣化（グレースフル・デグラデーション）で動作を維持します

## 関連項目 \{#related\}

* [AI トレーシングの概要](/docs/observability/ai-tracing/overview)
* [DefaultExporter](/docs/observability/ai-tracing/exporters/default)
* [Mastra Cloud ドキュメント](https://cloud.mastra.ai/docs)