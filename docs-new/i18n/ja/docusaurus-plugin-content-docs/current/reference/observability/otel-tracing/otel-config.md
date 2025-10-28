---
title: "リファレンス: OtelConfig"
description: OpenTelemetry のインストルメンテーション、トレース、およびエクスポート動作を構成する OtelConfig オブジェクトのドキュメント。
---

# `OtelConfig` \{#otelconfig\}

`OtelConfig` オブジェクトは、アプリケーション内で OpenTelemetry のインストルメンテーション、トレーシング、およびエクスポート動作を設定するために使用します。プロパティを調整することで、トレースなどのテレメトリーデータの収集、サンプリング、エクスポートの方法を制御できます。

Mastra で `OtelConfig` を使用するには、Mastra を初期化する際に `telemetry` キーの値として渡します。これにより、トレーシングとインストルメンテーションに関するカスタムの OpenTelemetry 設定が Mastra に適用されます。

```typescript showLineNumbers copy
import { Mastra } from 'mastra';

const otelConfig: OtelConfig = {
  serviceName: 'my-awesome-service',
  enabled: true,
  sampling: {
    type: 'ratio',
    probability: 0.5,
  },
  export: {
    type: 'otlp',
    endpoint: 'https://otel-collector.example.com/v1/traces',
    headers: {
      Authorization: 'Bearer YOUR_TOKEN_HERE',
    },
  },
};
```

### プロパティ \{#properties\}

<PropertiesTable
  content={[
{
name: "serviceName",
type: "string",
isOptional: true,
default: "default-service",
description:
"テレメトリーのバックエンドでサービスを識別するための、人間が読める名称。",
},
{
name: "enabled",
type: "boolean",
isOptional: true,
default: "true",
description: "テレメトリーの収集とエクスポートを有効にするかどうか。",
},
{
name: "sampling",
type: "SamplingStrategy",
isOptional: true,
description:
"トレースのサンプリング戦略を定義し、収集するデータ量を制御します。",
properties: [
{
name: "type",
type: `'ratio' | 'always_on' | 'always_off' | 'parent_based'`,
description: "サンプリング戦略のタイプを指定します。",
},
{
name: "probability",
type: "number (0.0 to 1.0)",
isOptional: true,
description:
"`ratio` または `parent_based` 戦略の場合のサンプリング確率を指定します。",
},
{
name: "root",
type: "object",
isOptional: true,
description:
"`parent_based` 戦略におけるルートレベルの確率サンプリングを設定します。",
properties: [
{
name: "probability",
type: "number (0.0 to 1.0)",
isOptional: true,
description:
"`parent_based` 戦略におけるルートトレースのサンプリング確率。",
},
],
},
],
},
{
name: "export",
type: "object",
isOptional: true,
description: "収集したテレメトリーデータのエクスポート設定。",
properties: [
{
name: "type",
type: `'otlp' | 'console'`,
description:
"エクスポーターのタイプを指定します。外部エクスポートには `otlp`、開発には `console` を使用します。",
},
{
name: "endpoint",
type: "string",
isOptional: true,
description:
"`otlp` の場合、トレース送信先の OTLP エンドポイント URL。",
},
{
name: "headers",
type: "Record<string, string>",
isOptional: true,
description:
"OTLP リクエストに付与する追加ヘッダー。認証やルーティングに利用します。",
},
],
},
]}
/>