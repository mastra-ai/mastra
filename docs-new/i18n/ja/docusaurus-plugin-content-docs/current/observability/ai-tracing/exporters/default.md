---
title: "デフォルトのエクスポーター"
description: "開発やデバッグ用にトレースをローカルに保存する"
---

# デフォルトエクスポーター \{#default-exporter\}

`DefaultExporter` は、トレースを設定済みのストレージバックエンドに保存し、Mastra Playground から参照できるようにします。デフォルトのオブザーバビリティ設定を使用している場合は自動的に有効になり、外部サービスは不要です。

## DefaultExporter を使用するタイミング \{#when-to-use-defaultexporter\}

DefaultExporter は次の用途に最適です:

* **ローカル開発** - オフラインでトレースをデバッグ・分析
* **データの所有権** - トレースデータを完全に管理
* **依存関係ゼロ** - 外部サービスは不要
* **Playground との統合** - Mastra Playground の UI でトレースを表示

## 設定 \{#configuration\}

### 前提条件 \{#prerequisites\}

1. **Storage Backend**: ストレージプロバイダを構成する（LibSQL、PostgreSQL など）
2. **Mastra Playground**: ローカルでトレースを確認できるようにインストールする

### 基本設定 \{#basic-setup\}

```typescript filename="src/mastra/index.ts"
import { Mastra } from '@mastra/core';
import { DefaultExporter } from '@mastra/core/ai-tracing';
import { LibSQLStore } from '@mastra/libsql';

export const mastra = new Mastra({
  storage: new LibSQLStore({
    url: 'file:./mastra.db', // トレースを永続化するために必須
  }),
  observability: {
    configs: {
      local: {
        serviceName: 'my-service',
        exporters: [new DefaultExporter()],
      },
    },
  },
});
```

### 自動構成 \{#automatic-configuration\}

デフォルトのオブザーバビリティ設定を使用すると、DefaultExporter が自動的に含まれます。

```typescript
export const mastra = new Mastra({
  storage: new LibSQLStore({
    url: 'file:./mastra.db',
  }),
  observability: {
    default: { enabled: true }, // DefaultExporterが自動的に含まれます
  },
});
```

## トレースを表示する \{#viewing-traces\}

### Mastra Playground \{#mastra-playground\}

ローカルのPlaygroundからトレースにアクセスします：

1. Playgroundを起動する
2. Observabilityに移動する
3. ローカルトレースをフィルタリングして検索する
4. スパンの詳細情報を確認する

## トレーシング戦略 \{#tracing-strategies\}

DefaultExporter は、利用中のストレージプロバイダーに応じて最適なトレーシング戦略を自動で選択します。必要に応じて、この選択を手動で上書きすることもできます。

### 利用可能な戦略 \{#available-strategies\}

| 戦略                   | 説明                                                     | ユースケース                      |
| ---------------------- | -------------------------------------------------------- | --------------------------------- |
| **realtime**           | 各イベントを即時に処理する                               | 開発、デバッグ、低トラフィック     |
| **batch-with-updates** | イベントをバッファし、ライフサイクル全体に対応してバッチ書き込み | 本番（低トラフィック）             |
| **insert-only**        | 完了したスパンのみ処理し、更新は無視                     | 本番（高トラフィック）             |

### 戦略の設定 \{#strategy-configuration\}

```typescript
new DefaultExporter({
  strategy: 'auto', // 既定値 - ストレージプロバイダーに任せる
  // または明示的に指定:
  // strategy: 'realtime' | 'batch-with-updates' | 'insert-only'

  // バッチ設定（batch-with-updates と insert-only の両方に適用）
  maxBatchSize: 1000, // バッチあたりの最大スパン数
  maxBatchWaitMs: 5000, // フラッシュまでの最大待機時間
  maxBufferSize: 10000, // バッファに保持する最大スパン数
});
```

## ストレージプロバイダーのサポート \{#storage-provider-support\}

ストレージプロバイダーごとに、対応しているトレーシング戦略は異なります。

戦略を `'auto'` に設定すると、`DefaultExporter` がストレージプロバイダーに最適な戦略を自動的に選択します。ストレージプロバイダーがサポートしていないモードを設定した場合は、エラーメッセージが表示されます。

| ストレージプロバイダー                              | 推奨戦略               | サポートされる戦略                            | 備考                                   |
| ---------------------------------------------------- | ---------------------- | --------------------------------------------- | -------------------------------------- |
| **[LibSQL](/docs/reference/storage/libsql)**         | batch-with-updates     | realtime, batch-with-updates, insert-only     | 既定のストレージ。開発向けに適しています |
| **[PostgreSQL](/docs/reference/storage/postgresql)** | batch-with-updates     | batch-with-updates, insert-only               | 本番環境に推奨                         |

### 戦略の利点 \{#strategy-benefits\}

* **realtime**: 即時に可視化でき、デバッグに最適
* **batch-with-updates**: スループットが10～100倍に向上、スパンのライフサイクルを完全に管理
* **insert-only**: データベース操作をさらに70%削減、分析に最適

## バッチの挙動 \{#batching-behavior\}

### フラッシュトリガー \{#flush-triggers\}

両方のバッチ戦略（`batch-with-updates` と `insert-only`）では、次のいずれかの条件を満たすとトレースはストレージにフラッシュされます：

1. **サイズトリガー**：バッファ内のスパン数が `maxBatchSize` に達したとき
2. **時間トリガー**：最初のイベントから `maxBatchWaitMs` が経過したとき
3. **緊急フラッシュ**：バッファが `maxBufferSize` の上限に近づいたとき
4. **シャットダウン**：保留中のすべてのイベントを強制的にフラッシュ

### エラー処理 \{#error-handling\}

DefaultExporter には本番運用向けの堅牢なエラー処理が備わっています:

* **リトライ ロジック**: 指数バックオフ（500ms、1s、2s、4s）
* **一時的な失敗**: バックオフ付きで自動リトライ
* **持続的な失敗**: 4回失敗した時点でバッチを破棄
* **バッファ オーバーフロー**: ストレージ障害時のメモリ問題を防止

### 設定例 \{#configuration-examples\}

```typescript
// 設定不要 — ほとんどのユーザーに推奨
new DefaultExporter();

// 開発時のオーバーライド
new DefaultExporter({
  strategy: 'realtime', // デバッグのため即時反映
});

// 高スループット向け本番
new DefaultExporter({
  maxBatchSize: 2000, // バッチを大きく
  maxBatchWaitMs: 10000, // バッチがたまるまで長めに待機
  maxBufferSize: 50000, // 長めの障害にも対応
});

// 低レイテンシ向け本番
new DefaultExporter({
  maxBatchSize: 100, // バッチを小さく
  maxBatchWaitMs: 1000, // すばやくフラッシュ
});
```

## 関連情報 \{#related\}

* [AI トレーシングの概要](/docs/observability/ai-tracing/overview)
* [CloudExporter](/docs/observability/ai-tracing/exporters/cloud)
* [ストレージ構成](/docs/server-db/storage)