---
title: "AITracing "
description: AI トレーシングの中核クラスとメソッド
asIndexPage: true
---

# AITracing \{#aitracing\}

## DefaultAITracing \{#defaultaitracing\}

AITracing インターフェースの標準実装。

### コンストラクタ \{#constructor\}

```typescript
new DefaultAITracing(config: TracingConfig)
```

指定された構成で新しい DefaultAITracing インスタンスを作成します。

### プロパティ \{#properties\}

BaseAITracing のすべてのプロパティとメソッドを継承します。

## BaseAITracing \{#baseaitracing\}

カスタムAIトレーシング実装向けの基底クラス。

### 方法 \{#methods\}

#### getConfig \{#getconfig\}

```typescript
getConfig(): Readonly<Required<TracingConfig>>
```

現在のトレース設定を返します。

#### getExporters \{#getexporters\}

```typescript
getExporters(): readonly AITracingExporter[]
```

設定されているすべてのエクスポーターを返します。

#### getProcessors \{#getprocessors\}

```typescript
getProcessors(): readonly AISpanProcessor[]
```

構成済みのすべてのプロセッサを返します。

#### getLogger \{#getlogger\}

```typescript
getLogger(): IMastraLogger を返します
```

エクスポーターやその他のコンポーネント向けのロガーインスタンスを返します。

#### startSpan \{#startspan\}

```typescript
startSpan<TType extends AISpanType>(
  options: StartSpanOptions<TType>
): AISpan<TType>
```

特定のAISpanTypeの新しいスパンを開始します。親が指定されていない場合は、トレースのルートスパンを作成します。

<PropertiesTable
  props={[
{
name: "type",
type: "AISpanType",
description: "作成するスパンのタイプ",
required: true,
},
{
name: "name",
type: "string",
description: "スパン名",
required: true,
},
{
name: "parent",
type: "AnyAISpan",
description: "親スパン（ルートでない場合）",
required: false,
},
{
name: "attributes",
type: "AISpanTypeMap[TType]",
description: "タイプ固有の属性",
required: false,
},
{
name: "metadata",
type: "Record<string, any>",
description: "ユーザー定義メタデータ",
required: false,
},
{
name: "input",
type: "any",
description: "初期入力データ",
required: false,
},
{
name: "customSamplerOptions",
type: "CustomSamplerOptions",
description: "カスタムサンプラー用オプション",
required: false,
},
]}
/>

#### シャットダウン \{#shutdown\}

```typescript
async shutdown(): Promise<void>
```

すべてのエクスポーターとプロセッサをシャットダウンし、リソースを解放します。

## カスタム実装 \{#custom-implementation\}

独自の AI トレーシング実装を作成するには、BaseAITracing を拡張します。

```typescript
class CustomAITracing extends BaseAITracing {
  constructor(config: TracingConfig) {
    super(config);
    // カスタム初期化処理
  }

  // 必要に応じてメソッドをオーバーライドする
  startSpan<TType extends AISpanType>(options: StartSpanOptions<TType>): AISpan<TType> {
    // スパンのカスタム作成ロジック
    return super.startSpan(options);
  }
}
```

## NO-OP スパン \{#no-op-spans\}

トレーシングが無効化されている（サンプリングが false を返す）場合、NO-OP スパンが返されます。

### NoOpAISpan \{#noopaispan\}

```typescript
class NoOpAISpan<TType extends AISpanType> extends BaseAISpan<TType>
```

何も処理を行わないスパン。すべてのメソッドは no-op です:

* `id` は `'no-op'` を返す
* `traceId` は `'no-op-trace'` を返す
* `isValid` は `false` を返す
* `end()`, `error()`, `update()` は何もしない
* `createChildSpan()` は別の no-op スパンを返す

## 参考 \{#see-also\}

### ドキュメント \{#documentation\}

* [AI Tracing の概要](/docs/observability/ai-tracing/overview) - 概要と使い方ガイド
* [設定リファレンス](/docs/reference/observability/ai-tracing/configuration) - 設定項目
* [インターフェースリファレンス](/docs/reference/observability/ai-tracing/interfaces) - 型定義
* [スパンリファレンス](/docs/reference/observability/ai-tracing/span) - スパンのライフサイクルとメソッド

### 例 \{#examples\}

* [Basic AI Tracing](/docs/examples/observability/basic-ai-tracing) - はじめての例

### エクスポーター \{#exporters\}

* [DefaultExporter](/docs/reference/observability/ai-tracing/exporters/default-exporter) - ストレージへの永続化
* [CloudExporter](/docs/reference/observability/ai-tracing/exporters/cloud-exporter) - Mastra Cloud 連携
* [ConsoleExporter](/docs/reference/observability/ai-tracing/exporters/console-exporter) - デバッグ出力