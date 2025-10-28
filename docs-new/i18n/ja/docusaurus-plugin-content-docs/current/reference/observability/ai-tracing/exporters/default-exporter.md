---
title: "DefaultExporter"
description: DefaultExporter の API リファレンス
---

# DefaultExporter \{#defaultexporter\}

トレースを自動バッチ化とリトライロジック付きで、Mastra で設定されたストレージに永続化します。

## コンストラクタ \{#constructor\}

```typescript
new DefaultExporter(config?: BatchingConfig, logger?: IMastraLogger)
```

<PropertiesTable
  props={[
{
name: "config",
type: "BatchingConfig",
description: "バッチ処理の構成オプション",
required: false,
},
{
name: "logger",
type: "IMastraLogger",
description: "ロガーのインスタンス。指定しない場合は、INFO レベルの ConsoleLogger が使用されます",
required: false,
},
]}
/>

## BatchingConfig \{#batchingconfig\}

```typescript
interface BatchingConfig {
  /** バッチあたりのスパンの最大数。デフォルト: 1000 */
  maxBatchSize?: number;

  /** 緊急フラッシュ前の最大バッファサイズ。デフォルト: 10000 */
  maxBufferSize?: number;

  /** バッチをフラッシュするまでの最大待機時間(ミリ秒単位)。デフォルト: 5000 */
  maxBatchWaitMs?: number;

  /** 最大再試行回数。デフォルト: 4 */
  maxRetries?: number;

  /** 再試行の基本遅延時間(ミリ秒単位、指数バックオフを使用)。デフォルト: 500 */
  retryDelayMs?: number;

  /** トレーシング戦略、または自動選択の場合は 'auto'。デフォルト: 'auto' */
  strategy?: TracingStrategy | 'auto';
}
```

## TracingStrategy（トレーシング戦略） \{#tracingstrategy\}

```typescript
type TracingStrategy = 'realtime' | 'batch-with-updates' | 'insert-only';
```

### ストラテジーの動作 \{#strategy-behaviors\}

* **realtime**: 各イベントを即時にストレージへ永続化する
* **batch-with-updates**: 作成と更新を別々にバッチ処理し、順序どおりに適用する
* **insert-only**: SPAN&#95;ENDED イベントのみを処理し、更新は無視する

## プロパティ \{#properties\}

```typescript
readonly name = 'tracing-default-exporter';
```

## メソッド \{#methods\}

### &#95;&#95;registerMastra \{#&#95;&#95;registermastra\}

```typescript
__registerMastra(mastra: Mastra): void
```

Mastra インスタンスを登録します。Mastra の生成後に自動的に呼び出されます。

### init \{#init\}

```typescript
init(): void
```

依存関係の準備が整い次第、エクスポーターを初期化します。ストレージの機能に応じてトレーシング戦略を決定します。

### exportEvent \{#exportevent\}

```typescript
async exportEvent(event: AITracingEvent): Promise<void>
```

解決済みの戦略に基づいてトレースイベントを処理します。

<PropertiesTable
  props={[
{
name: "event",
type: "AITracingEvent",
description: "エクスポート対象のトレースイベント",
required: true,
},
]}
/>

### シャットダウン \{#shutdown\}

```typescript
async shutdown(): Promise<void>
```

残っているバッファ内のイベントをフラッシュし、後処理を行います。

## 戦略の自動選択 \{#automatic-strategy-selection\}

`strategy: 'auto'`（デフォルト）の場合、エクスポーターはストレージアダプターに、その対応機能を問い合わせます：

```typescript
interface AITracingStrategy {
  /** このアダプターがサポートする戦略 */
  supported: TracingStrategy[];

  /** 最適なパフォーマンスを実現するための推奨戦略 */
  preferred: TracingStrategy;
}
```

エクスポーターは次のように動作します：

1. 可能であれば、ストレージアダプターの推奨戦略を使用する
2. 推奨戦略が利用できない場合は、最初にサポートされている戦略にフォールバックする
3. ユーザー指定の戦略がサポートされていない場合は、警告を記録する

## バッチの動作 \{#batching-behavior\}

### フラッシュのトリガー \{#flush-triggers\}

次のいずれかの条件を満たすと、バッファはフラッシュされます:

* バッファサイズが `maxBatchSize` に達したとき
* 最初のイベントをバッファしてからの経過時間が `maxBatchWaitMs` を超えたとき
* バッファサイズが `maxBufferSize` に達したとき（緊急フラッシュ）
* `shutdown()` が呼び出されたとき

### リトライロジック \{#retry-logic\}

失敗したフラッシュは指数バックオフで再試行されます：

* リトライ遅延：`retryDelayMs * 2^attempt`
* 最大リトライ回数：`maxRetries`
* すべてのリトライが失敗した場合、バッチは破棄されます

### 順不同処理 \{#out-of-order-handling\}

`batch-with-updates` 戦略の場合:

* どの span が作成済みかを追跡する
* まだ作成されていない span への更新/終了を拒否する
* 順不同のイベントについて警告を記録する
* 更新の順序を保つためにシーケンス番号を維持する

## 使い方 \{#usage\}

```typescript
import { DefaultExporter } from '@mastra/core/ai-tracing';

// デフォルト設定
const exporter = new DefaultExporter();

// カスタムバッチ処理設定
const customExporter = new DefaultExporter({
  maxBatchSize: 500,
  maxBatchWaitMs: 2000,
  strategy: 'batch-with-updates',
});
```

## 関連項目 \{#see-also\}

### ドキュメント \{#documentation\}

* [AI Tracing の概要](/docs/observability/ai-tracing/overview) - 総合ガイド
* [エクスポーター](/docs/observability/ai-tracing/overview#exporters) - エクスポーターの概念

### その他のエクスポーター \{#other-exporters\}

* [CloudExporter](/docs/reference/observability/ai-tracing/exporters/cloud-exporter) - Mastra Cloud
* [ConsoleExporter](/docs/reference/observability/ai-tracing/exporters/console-exporter) - デバッグ出力
* [Langfuse](/docs/reference/observability/ai-tracing/exporters/langfuse) - Langfuse との連携
* [Braintrust](/docs/reference/observability/ai-tracing/exporters/braintrust) - Braintrust との連携

### リファレンス \{#reference\}

* [Configuration](/docs/reference/observability/ai-tracing/configuration) - 構成オプション
* [Interfaces](/docs/reference/observability/ai-tracing/interfaces) - インターフェース定義