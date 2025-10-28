---
title: "ConsoleExporter"
description: ConsoleExporter の API リファレンス
---

# ConsoleExporter \{#consoleexporter\}

デバッグや開発時の利用を想定し、トレースイベントをコンソールに出力します。

## コンストラクタ \{#constructor\}

```typescript
new ConsoleExporter(logger?: IMastraLogger)
```

<PropertiesTable
  props={[
{
name: "logger",
type: "IMastraLogger",
description: "使用するロガーインスタンス。未指定の場合は、INFOレベルのConsoleLoggerにフォールバックします",
required: false,
},
]}
/>

## プロパティ \{#properties\}

```typescript
readonly name = 'tracing-console-exporter';
```

## メソッド \{#methods\}

### exportEvent \{#exportevent\}

```typescript
async exportEvent(event: AITracingEvent): Promise<void>
```

トレースイベントをコンソールに出力します。

<PropertiesTable
  props={[
{
name: "event",
type: "AITracingEvent",
description: "出力するトレースイベント",
required: true,
},
]}
/>

### シャットダウン \{#shutdown\}

```typescript
async shutdown(): Promise<void>
```

シャットダウンメッセージをログに記録します。

## 出力形式 \{#output-format\}

エクスポーターはイベントの種類に応じて異なる形式を出力します。

### SPAN&#95;開始 \{#span&#95;started\}

```
🚀 SPAN_STARTED
   種別: [span type]
   名称: [span name]
   ID: [span id]
   トレースID: [trace id]
   入力: [formatted input]
   属性: [formatted attributes]
────────────────────────────────────────
```

### スパン終了 \{#span&#95;ended\}

```
✅ SPAN_ENDED
   タイプ: [span type]
   名前: [span name]
   ID: [span id]
   所要時間: [duration]ms
   トレースID: [trace id]
   入力: [formatted input]
   出力: [formatted output]
   エラー: [formatted error if present]
   属性: [formatted attributes]
────────────────────────────────────────
```

### SPAN&#95;UPDATED \{#span&#95;updated\}

```
📝 SPAN_UPDATED
   タイプ: [span type]
   名前: [span name]
   ID: [span id]
   トレースID: [trace id]
   入力: [formatted input]
   出力: [formatted output]
   エラー: [formatted error if present]
   更新された属性: [formatted attributes]
────────────────────────────────────────
```

## 使い方 \{#usage\}

```typescript
import { ConsoleExporter } from '@mastra/core/ai-tracing';
import { ConsoleLogger, LogLevel } from '@mastra/core/logger';

// デフォルトのロガーを使用（INFOレベル）
const exporter = new ConsoleExporter();

// カスタムロガーを使用
const customLogger = new ConsoleLogger({ level: LogLevel.DEBUG });
const exporterWithLogger = new ConsoleExporter(customLogger);
```

## 実装の詳細 \{#implementation-details\}

* 属性を2スペースインデントのJSONとして整形
* スパンの所要時間をミリ秒で算出して表示
* シリアライズエラーを適切に処理
* 未実装のイベントタイプを警告としてログに記録
* イベント間に80文字幅の区切り線を使用

## 関連項目 \{#see-also\}

### ドキュメント \{#documentation\}

* [AI Tracing の概要](/docs/observability/ai-tracing/overview) - すべてを網羅したガイド
* [エクスポーター](/docs/observability/ai-tracing/overview#exporters) - エクスポーターの概念

### その他のエクスポーター \{#other-exporters\}

* [DefaultExporter](/docs/reference/observability/ai-tracing/exporters/default-exporter) - ストレージの永続化
* [CloudExporter](/docs/reference/observability/ai-tracing/exporters/cloud-exporter) - Mastra Cloud
* [Langfuse](/docs/reference/observability/ai-tracing/exporters/langfuse) - Langfuse との連携
* [Braintrust](/docs/reference/observability/ai-tracing/exporters/braintrust) - Braintrust との連携

### 参考 \{#reference\}

* [Configuration](/docs/reference/observability/ai-tracing/configuration) - 設定項目
* [Interfaces](/docs/reference/observability/ai-tracing/interfaces) - 型定義