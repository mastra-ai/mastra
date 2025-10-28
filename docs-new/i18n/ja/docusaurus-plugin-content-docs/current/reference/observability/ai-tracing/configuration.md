---
title: "設定"
description: AI Tracing の設定タイプとレジストリ関数
---

# 設定 \{#configuration\}

## ObservabilityRegistryConfig \{#observabilityregistryconfig\}

```typescript
interface ObservabilityRegistryConfig {
  default?: { enabled?: boolean };
  configs?: Record<string, TracingConfig | AITracing>;
  configSelector?: ConfigSelector;
}
```

<PropertiesTable
  props={[
{
name: "default",
type: "{ enabled?: boolean }",
description: "デフォルト構成を有効にする",
required: false,
},
{
name: "configs",
type: "Record<string, TracingConfig | AITracing>",
description: "名前付きトレーシング構成",
required: false,
},
{
name: "configSelector",
type: "ConfigSelector",
description: "実行時構成セレクター",
required: false,
},
]}
/>

## トレーシング設定（TracingConfig） \{#tracingconfig\}

```typescript
interface TracingConfig {
  name: string;
  serviceName: string;
  sampling?: SamplingStrategy;
  exporters?: AITracingExporter[];
  processors?: AISpanProcessor[];
}
```

<PropertiesTable
  props={[
{
name: "name",
type: "string",
description: "構成識別子",
required: true,
},
{
name: "serviceName",
type: "string",
description: "トレース上のサービス名",
required: true,
},
{
name: "sampling",
type: "SamplingStrategy",
description: "サンプリング設定",
required: false,
},
{
name: "exporters",
type: "AITracingExporter[]",
description: "トレースデータのエクスポーター",
required: false,
},
{
name: "processors",
type: "AISpanProcessor[]",
description: "スパン処理器",
required: false,
},
]}
/>

## サンプリング戦略 \{#samplingstrategy\}

```typescript
type SamplingStrategy =
  | { type: 'always' }
  | { type: 'never' }
  | { type: 'ratio'; probability: number }
  | { type: 'custom'; sampler: (options?: TracingOptions) => boolean };
```

## ConfigSelector \{#configselector\}

```typescript
type ConfigSelector = (options: ConfigSelectorOptions, availableConfigs: Map<string, AITracing>) => string | undefined;
```

## ConfigSelectorOptions（Config セレクターのオプション） \{#configselectoroptions\}

```typescript
interface ConfigSelectorOptions {
  metadata?: Record<string, any>;
  runtimeContext?: Map<string, any>;
}
```

# レジストリ機能 \{#registry-functions\}

## setupAITracing \{#setupaitracing\}

```typescript
function setupAITracing(config: ObservabilityRegistryConfig): void;
```

設定に基づいてAIのトレースを初期化します。Mastra のコンストラクタによって自動的に呼び出されます。

## registerAITracing \{#registeraitracing\}

```typescript
function registerAITracing(name: string, instance: AITracing, isDefault?: boolean): void;
```

グローバルレジストリにトレース設定を登録します。

## getAITracing \{#getaitracing\}

```typescript
function getAITracing(name: string): AITracing | undefined;
```

名前を指定してトレース設定を取得します。

## getDefaultAITracing \{#getdefaultaitracing\}

```typescript
function getDefaultAITracing(): AITracing | undefined;
```

デフォルトのトレーシング設定を返します。

## getSelectedAITracing \{#getselectedaitracing\}

```typescript
function getSelectedAITracing(options: ConfigSelectorOptions): AITracing | undefined;
```

コンフィグセレクターで選択されたトレーシング設定、またはデフォルトの設定を返します。

## setSelector \{#setselector\}

```typescript
function setSelector(selector: ConfigSelector): void;
```

グローバル設定のセレクター関数を設定します。

## unregisterAITracing \{#unregisteraitracing\}

```typescript
function unregisterAITracing(name: string): boolean;
```

レジストリからトレース設定を削除します。

## shutdownAITracingRegistry \{#shutdownaitracingregistry\}

```typescript
async function shutdownAITracingRegistry(): Promise<void>;
```

すべてのトレーシング設定を停止し、レジストリを消去します。

## clearAITracingRegistry \{#clearaitracingregistry\}

```typescript
function clearAITracingRegistry(): void;
```

シャットダウンせずにすべての設定を消去します。

## getAllAITracing \{#getallaitracing\}

```typescript
function getAllAITracing(): ReadonlyMap<string, AITracing>;
```

登録されているすべてのトレーシング設定を返します。

## hasAITracing \{#hasaitracing\}

```typescript
function hasAITracing(name: string): boolean;
```

トレースのインスタンスが存在し、かつ有効化されているかを確認します。

## 関連情報 \{#see-also\}

### ドキュメント \{#documentation\}

* [AI トレーシングの概要](/docs/observability/ai-tracing/overview) - 概念と使い方ガイド
* [サンプリング戦略](/docs/observability/ai-tracing/overview#sampling-strategies) - サンプリング設定の詳細
* [複数構成のセットアップ](/docs/observability/ai-tracing/overview#multi-config-setup) - 複数の構成を利用する方法

### 参考 \{#reference\}

* [AITracing クラス](/docs/reference/observability/ai-tracing) - トレーシングの中核となるクラス
* [インターフェース](/docs/reference/observability/ai-tracing/interfaces) - 型定義
* [スパン リファレンス](/docs/reference/observability/ai-tracing/span) - スパンのライフサイクル

### 例 \{#examples\}

* [Basic AI Tracing](/docs/examples/observability/basic-ai-tracing) - 入門

### エクスポーター \{#exporters\}

* [DefaultExporter](/docs/reference/observability/ai-tracing/exporters/default-exporter) - ストレージ設定
* [CloudExporter](/docs/reference/observability/ai-tracing/exporters/cloud-exporter) - クラウド設定
* [Braintrust](/docs/reference/observability/ai-tracing/exporters/braintrust) - Braintrust との連携
* [Langfuse](/docs/reference/observability/ai-tracing/exporters/langfuse) - Langfuse との連携
* [LangSmith](/docs/reference/observability/ai-tracing/exporters/langsmith) - LangSmith との連携