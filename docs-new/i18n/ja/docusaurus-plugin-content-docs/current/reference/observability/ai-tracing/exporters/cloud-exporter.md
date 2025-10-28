---
title: "CloudExporter"
description: CloudExporter のAPIリファレンス
---

# CloudExporter \{#cloudexporter\}

トレースを Mastra Cloud に送信し、オンラインでの可視化と監視を可能にします。

## コンストラクタ \{#constructor\}

```typescript
new CloudExporter(config?: CloudExporterConfig)
```

<PropertiesTable
  props={[
{
name: "config",
type: "CloudExporterConfig",
description: "構成オプション",
required: false,
},
]}
/>

## CloudExporterConfig \{#cloudexporterconfig\}

```typescript
interface CloudExporterConfig {
  /** バッチ内のスパン最大数。デフォルト: 1000 */
  maxBatchSize?: number;

  /** フラッシュまでの最大待機時間（ミリ秒）。デフォルト: 5000 */
  maxBatchWaitMs?: number;

  /** リトライの最大試行回数。デフォルト: 3 */
  maxRetries?: number;

  /** クラウドのアクセストークン（環境変数または設定から） */
  accessToken?: string;

  /** クラウド AI トレーシング用エンドポイント */
  endpoint?: string;

  /** 任意のロガー */
  logger?: IMastraLogger;
}
```

## 環境変数 \{#environment-variables\}

エクスポーターは、設定で指定されていない場合、次の環境変数を読み込みます:

* `MASTRA_CLOUD_ACCESS_TOKEN` - 認証用アクセストークン
* `MASTRA_CLOUD_AI_TRACES_ENDPOINT` - カスタムエンドポイント（既定: `https://api.mastra.ai/ai/spans/publish`）

## プロパティ \{#properties\}

```typescript
読み取り専用 name = 'mastra-cloud-ai-tracing-exporter';
```

## メソッド \{#methods\}

### exportEvent \{#exportevent\}

```typescript
async exportEvent(event: AITracingEvent): Promise<void>
```

トレースイベントを処理します。Cloud には SPAN&#95;ENDED イベントのみをエクスポートします。

<PropertiesTable
  props={[
{
name: "event",
type: "AITracingEvent",
description: "エクスポートするトレースイベント",
required: true,
},
]}
/>

### シャットダウン \{#shutdown\}

```typescript
async shutdown(): Promise<void>
```

残存しているイベントをフラッシュし、後処理を行います。

## 動作 \{#behavior\}

### 認証 \{#authentication\}

config または環境変数でアクセストークンが指定されていない場合、exporter は次のように動作します:

* サインアップ方法の案内を含む警告をログに記録する
* no-op（何もしない）として動作し、すべてのイベントを破棄する

### バッチ処理 \{#batching\}

エクスポーターはネットワークを効率的に使うため、スパンをバッチ処理します：

* バッチサイズが `maxBatchSize` に達したらフラッシュします
* バッチ内の最初のスパンから `maxBatchWaitMs` 経過したらフラッシュします
* `shutdown()` 時にフラッシュします

### エラーハンドリング \{#error-handling\}

* `maxRetries` 回までの試行で指数バックオフによるリトライを実施
* すべてのリトライが失敗した場合、バッチを破棄
* エラーをログに記録しつつ、新規イベントの処理は継続

### イベント処理 \{#event-processing\}

* `SPAN_ENDED` イベントのみを処理します
* `SPAN_STARTED` および `SPAN_UPDATED` イベントは無視します
* スパンを MastraCloudSpanRecord 形式にフォーマットします

## MastraCloudSpanRecord \{#mastracloudspanrecord\}

クラウドスパンの内部フォーマット:

```typescript
interface MastraCloudSpanRecord {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  spanType: string;
  attributes: Record<string, any> | null;
  metadata: Record<string, any> | null;
  startedAt: Date;
  endedAt: Date | null;
  input: any;
  output: any;
  error: any;
  isEvent: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}
```

## 使い方 \{#usage\}

```typescript
import { CloudExporter } from '@mastra/core/ai-tracing';

// トークンには環境変数を使用します
const exporter = new CloudExporter();

// 明示的な構成
const customExporter = new CloudExporter({
  accessToken: 'your-token',
  maxBatchSize: 500,
  maxBatchWaitMs: 2000,
});
```

## 参照 \{#see-also\}

### ドキュメント \{#documentation\}

* [AI トレーシングの概要](/docs/observability/ai-tracing/overview) - まとめガイド
* [エクスポーター](/docs/observability/ai-tracing/overview#exporters) - エクスポーターの概念

### その他のエクスポーター \{#other-exporters\}

* [DefaultExporter](/docs/reference/observability/ai-tracing/exporters/default-exporter) - ストレージへの永続保存
* [ConsoleExporter](/docs/reference/observability/ai-tracing/exporters/console-exporter) - デバッグ出力
* [Langfuse](/docs/reference/observability/ai-tracing/exporters/langfuse) - Langfuse との連携
* [Braintrust](/docs/reference/observability/ai-tracing/exporters/braintrust) - Braintrust との連携

### リファレンス \{#reference\}

* [Configuration](/docs/reference/observability/ai-tracing/configuration) - 設定項目
* [Interfaces](/docs/reference/observability/ai-tracing/interfaces) - 型定義