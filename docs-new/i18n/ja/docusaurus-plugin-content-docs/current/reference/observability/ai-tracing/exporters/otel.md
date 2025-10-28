---
title: "OtelExporter "
description: AI トレース用の OpenTelemetry エクスポーター
---

# OtelExporter \{#otelexporter\}

:::warning

OtelExporter は現在**実験的**です。API や設定オプションは今後のリリースで変更される場合があります。

:::

標準化された GenAI セマンティック規約に従い、OpenTelemetry 対応のあらゆるオブザーバビリティプラットフォームに AI トレースデータを送信します。

## コンストラクタ \{#constructor\}

```typescript
new OtelExporter(config: OtelExporterConfig)
```

## OtelExporterConfig \{#otelexporterconfig\}

```typescript
interface OtelExporterConfig {
  provider?: ProviderConfig;
  timeout?: number;
  batchSize?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}
```

<PropertiesTable
  props={[
{
name: "provider",
type: "ProviderConfig",
description: "プロバイダ固有の構成（下記参照）",
required: true,
},
{
name: "timeout",
type: "number",
description: "エクスポートのタイムアウト（ミリ秒、既定: 30000）",
required: false,
},
{
name: "batchSize",
type: "number",
description: "バッチあたりのスパン数（既定: 100）",
required: false,
},
{
name: "logLevel",
type: "'debug' | 'info' | 'warn' | 'error'",
description: "ログレベル（既定: 'warn'）",
required: false,
},
]}
/>

## プロバイダーの構成 \{#provider-configurations\}

### Dash0Config \{#dash0config\}

```typescript
interface Dash0Config {
  apiKey: string;
  endpoint: string;
  dataset?: string;
}
```

<PropertiesTable
  props={[
{
name: "apiKey",
type: "string",
description: "Dash0 API キー",
required: true,
},
{
name: "endpoint",
type: "string",
description: "Dash0 の受け口エンドポイント（例：ingress.us-west-2.aws.dash0.com:4317）",
required: true,
},
{
name: "dataset",
type: "string",
description: "データ整理用の任意のデータセット名",
required: false,
},
]}
/>

### SigNozConfig \{#signozconfig\}

```typescript
interface SignozConfig {
  apiKey: string;
  region?: 'us' | 'eu' | 'in';
  endpoint?: string;
}
```

<PropertiesTable
  props={[
{
name: "apiKey",
type: "string",
description: "SigNoz 取り込み用キー",
required: true,
},
{
name: "region",
type: "'us' | 'eu' | 'in'",
description: "SigNoz クラウドのリージョン（既定: 'us'）",
required: false,
},
{
name: "endpoint",
type: "string",
description: "セルフホスト版 SigNoz 向けのカスタムエンドポイント",
required: false,
},
]}
/>

### NewRelicConfig \{#newrelicconfig\}

```typescript
interface NewRelicConfig {
  apiKey: string;
  endpoint?: string;
}
```

<PropertiesTable
  props={[
{
name: "apiKey",
type: "string",
description: "New Relic のライセンスキー",
required: true,
},
{
name: "endpoint",
type: "string",
description: "カスタムエンドポイント（既定値: https://otlp.nr-data.net:443/v1/traces）",
required: false,
},
]}
/>

### TraceloopConfig \{#traceloopconfig\}

```typescript
interface TraceloopConfig {
  apiKey: string;
  destinationId?: string;
  endpoint?: string;
}
```

<PropertiesTable
  props={[
{
name: "apiKey",
type: "string",
description: "Traceloop の API キー",
required: true,
},
{
name: "destinationId",
type: "string",
description: "オプションの宛先識別子",
required: false,
},
{
name: "endpoint",
type: "string",
description: "カスタムエンドポイント（既定: https://api.traceloop.com/v1/traces）",
required: false,
},
]}
/>

### LaminarConfig \{#laminarconfig\}

```typescript
interface LaminarConfig {
  apiKey: string;
  teamId?: string;
  endpoint?: string;
}
```

<PropertiesTable
  props={[
{
name: "apiKey",
type: "string",
description: "Laminar プロジェクトの API キー",
required: true,
},
{
name: "teamId",
type: "string",
description: "（後方互換性のための）任意のチーム識別子",
required: false,
},
{
name: "endpoint",
type: "string",
description: "カスタムエンドポイント（既定: https://api.lmnr.ai/v1/traces）",
required: false,
},
]}
/>

### カスタム構成 \{#customconfig\}

```typescript
interface CustomConfig {
  endpoint: string;
  protocol?: 'http/json' | 'http/protobuf' | 'grpc' | 'zipkin';
  headers?: Record<string, string>;
}
```

<PropertiesTable
  props={[
{
name: "endpoint",
type: "string",
description: "OTEL コレクターのエンドポイント URL",
required: true,
},
{
name: "protocol",
type: "'http/json' | 'http/protobuf' | 'grpc' | 'zipkin'",
description: "エクスポートプロトコル（既定値: 'http/json'）",
required: false,
},
{
name: "headers",
type: "Record<string, string>",
description: "認証用のカスタムヘッダー",
required: false,
},
]}
/>

## メソッド \{#methods\}

### exportEvent \{#exportevent\}

```typescript
async exportEvent(event: AITracingEvent): Promise<void>
```

設定済みの OTEL バックエンドにトレースイベントをエクスポートします。

### シャットダウン \{#shutdown\}

```typescript
async shutdown(): Promise<void>
```

未送信のトレースをフラッシュし、エクスポーターをシャットダウンします。

## 使い方の例 \{#usage-examples\}

### 基本的な使用方法 \{#basic-usage\}

```typescript
import { OtelExporter } from '@mastra/otel-exporter';

const exporter = new OtelExporter({
  provider: {
    signoz: {
      apiKey: process.env.SIGNOZ_API_KEY,
      region: 'us',
    },
  },
});
```

### カスタムエンドポイントを使う場合 \{#with-custom-endpoint\}

```typescript
const exporter = new OtelExporter({
  provider: {
    custom: {
      endpoint: 'https://my-collector.example.com/v1/traces',
      protocol: 'http/protobuf',
      headers: {
        'x-api-key': process.env.API_KEY,
      },
    },
  },
  timeout: 60000,
  logLevel: 'debug',
});
```

## スパンのマッピング \{#span-mapping\}

エクスポーターは、GenAI のセマンティック規約に従い、Mastra AI のスパンを OpenTelemetry のスパンにマッピングします。

### スパン名 \{#span-names\}

* `LLM_GENERATION` → `chat {model}` または `tool_selection {model}`
* `TOOL_CALL` → `tool.execute {tool_name}`
* `AGENT_RUN` → `agent.{agent_id}`
* `WORKFLOW_RUN` → `workflow.{workflow_id}`

### スパンの種類 \{#span-kinds\}

* ルートエージェント／ワークフローのスパン → `SERVER`
* LLM の呼び出し → `CLIENT`
* ツールの呼び出し → `INTERNAL` または `CLIENT`
* ワークフローのステップ → `INTERNAL`

### 属性 \{#attributes\}

エクスポーターは標準の OTEL GenAI 属性にマップされます：

| Mastra 属性                         | OTEL 属性                        |
| ----------------------------------- | -------------------------------- |
| `model`                             | `gen_ai.request.model`           |
| `provider`                          | `gen_ai.system`                  |
| `inputTokens` / `promptTokens`      | `gen_ai.usage.input_tokens`      |
| `outputTokens` / `completionTokens` | `gen_ai.usage.output_tokens`     |
| `temperature`                       | `gen_ai.request.temperature`     |
| `maxOutputTokens`                   | `gen_ai.request.max_tokens`      |
| `finishReason`                      | `gen_ai.response.finish_reasons` |

## プロトコル要件 \{#protocol-requirements\}

プロバイダーによって必要な OTEL エクスポーターのパッケージは異なります:

| プロトコル    | 必要なパッケージ                           | プロバイダー                |
| ------------- | ------------------------------------------ | -------------------------- |
| gRPC          | `@opentelemetry/exporter-trace-otlp-grpc`  | Dash0                      |
| HTTP/Protobuf | `@opentelemetry/exporter-trace-otlp-proto` | SigNoz, New Relic, Laminar |
| HTTP/JSON     | `@opentelemetry/exporter-trace-otlp-http`  | Traceloop, Custom          |
| Zipkin        | `@opentelemetry/exporter-zipkin`           | Zipkin collectors          |

## 親子関係 \{#parent-child-relationships\}

エクスポーターは、Mastra の AI トレーシングからスパンの階層構造を保持します。

* Mastra のスパンの `parentSpanId` をそのまま使用
* エージェント、ワークフロー、LLM 呼び出し、ツールの適切なネストを維持
* すべての関係を保持した完全なトレースをエクスポート