---
title: "OpenTelemetry エクスポーター"
description: "AI トレースを OpenTelemetry 互換の任意のオブザーバビリティ プラットフォームに送信する"
---

# OpenTelemetry エクスポーター \{#opentelemetry-exporter\}

:::warning

OpenTelemetry エクスポーターは現在**実験的**です。API や構成オプションは今後のリリースで変更される可能性があります。

:::

OpenTelemetry（OTEL）エクスポーターは、標準化された [OpenTelemetry Semantic Conventions for GenAI](https://opentelemetry.io/docs/specs/semconv/gen-ai/) に基づき、AI のトレースを任意の OTEL 互換オブザーバビリティプラットフォームへ送信します。これにより、Datadog、New Relic、SigNoz、Dash0、Traceloop、Laminar などのプラットフォームと幅広く互換性を持てます。

## OTEL Exporter を使う場面 \{#when-to-use-otel-exporter\}

OTEL exporter は次の用途に最適です:

* **プラットフォームの柔軟性** - 任意の OTEL 互換バックエンドへトレースを送信
* **標準準拠** - OpenTelemetry GenAI のセマンティック規約に準拠
* **マルチベンダー対応** - 一度の設定でプロバイダーを容易に切り替え
* **エンタープライズプラットフォーム** - 既存の可観測性（オブザーバビリティ）基盤と統合
* **カスタムコレクター** - 自社の OTEL コレクターに送信

## インストール \{#installation\}

各プロバイダーには特定のプロトコルパッケージが必要です。ベースのエクスポーターに加えて、使用するプロバイダー用のプロトコルパッケージをインストールしてください。

### HTTP/Protobuf プロバイダーの場合 (SigNoz、New Relic、Laminar) \{#for-httpprotobuf-providers-signoz-new-relic-laminar\}

```bash npm2yarn
npm install @mastra/otel-exporter @opentelemetry/exporter-trace-otlp-proto
```

### gRPC プロバイダ向け（Dash0） \{#for-grpc-providers-dash0\}

```bash npm2yarn
npm install @mastra/otel-exporter @opentelemetry/exporter-trace-otlp-grpc @grpc/grpc-js
```

### HTTP/JSON プロバイダ向け（Traceloop） \{#for-httpjson-providers-traceloop\}

```bash npm2yarn
npm install @mastra/otel-exporter @opentelemetry/exporter-trace-otlp-http
```

## プロバイダ設定 \{#provider-configurations\}

### Dash0 \{#dash0\}

[Dash0](https://www.dash0.com/) は、自動インサイトによるリアルタイムのオブザーバビリティを提供します。

```typescript filename="src/mastra/index.ts"
import { Mastra } from '@mastra/core';
import { OtelExporter } from '@mastra/otel-exporter';

export const mastra = new Mastra({
  observability: {
    configs: {
      otel: {
        serviceName: 'my-service',
        exporters: [
          new OtelExporter({
            provider: {
              dash0: {
                apiKey: process.env.DASH0_API_KEY,
                endpoint: process.env.DASH0_ENDPOINT, // 例: 'ingress.us-west-2.aws.dash0.com:4317'
                dataset: 'production', // オプションのデータセット名
              },
            },
          }),
        ],
      },
    },
  },
});
```

:::note

Dash0 のエンドポイントはダッシュボードから取得してください。形式は `ingress.{region}.aws.dash0.com:4317` です。

:::

### SigNoz \{#signoz\}

[SigNoz](https://signoz.io/) は、AI トレーシングを標準搭載したオープンソースの APM の代替ツールです。

```typescript filename="src/mastra/index.ts"
new OtelExporter({
  provider: {
    signoz: {
      apiKey: process.env.SIGNOZ_API_KEY,
      region: 'us', // 'us' | 'eu' | 'in'
      // endpoint: 'https://my-signoz.example.com', // セルフホスティング用
    },
  },
});
```

### New Relic \{#new-relic\}

[New Relic](https://newrelic.com/) は、AI によるモニタリング機能を備えた包括的なオブザーバビリティを提供します。

```typescript filename="src/mastra/index.ts"
new OtelExporter({
  provider: {
    newrelic: {
      apiKey: process.env.NEW_RELIC_LICENSE_KEY,
      // endpoint: 'https://otlp.eu01.nr-data.net', // EU リージョン用
    },
  },
});
```

### Traceloop \{#traceloop\}

[Traceloop](https://www.traceloop.com/) は、自動プロンプト追跡機能を備えた LLM 向けのオブザーバビリティに特化しています。

```typescript filename="src/mastra/index.ts"
new OtelExporter({
  provider: {
    traceloop: {
      apiKey: process.env.TRACELOOP_API_KEY,
      destinationId: 'my-destination', // 省略可能
    },
  },
});
```

### Laminar \{#laminar\}

[Laminar](https://www.lmnr.ai/) は、LLM の可観測性とアナリティクスに特化したソリューションを提供します。

```typescript filename="src/mastra/index.ts"
new OtelExporter({
  provider: {
    laminar: {
      apiKey: process.env.LMNR_PROJECT_API_KEY,
      // teamId: process.env.LAMINAR_TEAM_ID, // オプション。後方互換性のため
    },
  },
});
```

### カスタム／汎用 OTEL エンドポイント \{#customgeneric-otel-endpoints\}

その他の OTEL 互換プラットフォームやカスタムコレクター向け:

```typescript filename="src/mastra/index.ts"
new OtelExporter({
  provider: {
    custom: {
      endpoint: 'https://your-collector.example.com/v1/traces',
      protocol: 'http/protobuf', // 'http/json' | 'http/protobuf' | 'grpc'
      headers: {
        'x-api-key': process.env.API_KEY,
      },
    },
  },
});
```

## 設定のオプション \{#configuration-options\}

### 完全な設定 \{#complete-configuration\}

```typescript
new OtelExporter({
  // プロバイダー設定(必須)
  provider: {
    // 次のいずれかを使用: dash0, signoz, newrelic, traceloop, laminar, custom
  },

  // エクスポート設定
  timeout: 30000, // エクスポートのタイムアウト(ミリ秒)
  batchSize: 100, // バッチあたりのスパン数

  // デバッグオプション
  logLevel: 'info', // 'debug' | 'info' | 'warn' | 'error'
});
```

## OpenTelemetry セマンティック規約 \{#opentelemetry-semantic-conventions\}

エクスポーターは [OpenTelemetry Semantic Conventions for GenAI](https://opentelemetry.io/docs/specs/semconv/gen-ai/) に準拠し、オブザーバビリティプラットフォームとの互換性を担保します。

### スパンの命名 \{#span-naming\}

* **LLM の操作**: `chat {model}` または `tool_selection {model}`
* **ツールの実行**: `tool.execute {tool_name}`
* **エージェントの実行**: `agent.{agent_id}`
* **ワークフローの実行**: `workflow.{workflow_id}`

### 主要属性 \{#key-attributes\}

* `gen_ai.operation.name` - 操作タイプ（chat、tool.execute など）
* `gen_ai.system` - AI プロバイダー（openai、anthropic など）
* `gen_ai.request.model` - モデル ID
* `gen_ai.usage.input_tokens` - 入力トークン数
* `gen_ai.usage.output_tokens` - 出力トークン数
* `gen_ai.request.temperature` - サンプリング温度
* `gen_ai.response.finish_reasons` - 終了理由

## バッファリング戦略 \{#buffering-strategy\}

エクスポーターは、トレースが完了するまでスパンをバッファリングします:

1. トレースに含まれるすべてのスパンを収集する
2. ルートスパンの完了後に 5 秒待機する
3. 親子関係を保持した完全なトレースをエクスポートする
4. 孤立スパンが発生しないようにする

## プロトコル選択ガイド \{#protocol-selection-guide\}

利用するプロバイダーに合わせて、適切なプロトコル用パッケージを選択してください:

| プロバイダー | プロトコル     | 必要なパッケージ                             |
| ------------ | -------------- | -------------------------------------------- |
| Dash0        | gRPC           | `@opentelemetry/exporter-trace-otlp-grpc`    |
| SigNoz       | HTTP/Protobuf  | `@opentelemetry/exporter-trace-otlp-proto`   |
| New Relic    | HTTP/Protobuf  | `@opentelemetry/exporter-trace-otlp-proto`   |
| Traceloop    | HTTP/JSON      | `@opentelemetry/exporter-trace-otlp-http`    |
| Laminar      | HTTP/Protobuf  | `@opentelemetry/exporter-trace-otlp-proto`   |
| Custom       | さまざま       | コレクターの構成に依存します                 |

:::warning

ご利用のプロバイダーに対応したプロトコル用パッケージを必ずインストールしてください。誤ったパッケージをインストールした場合は、エクスポーターがわかりやすいエラーメッセージを表示します。

:::

## トラブルシューティング \{#troubleshooting\}

### 依存関係が見つからないエラー \{#missing-dependency-error\}

次のようなエラーが表示される場合:

```
HTTP/Protobuf エクスポーターがインストールされていません（signoz に必要）。
HTTP/Protobuf エクスポートを使用するには、以下のパッケージをインストールしてください：
  npm install @opentelemetry/exporter-trace-otlp-proto
```

ご利用のプロバイダーに推奨されているパッケージをインストールしてください。

### よくある問題 \{#common-issues\}

1. **誤ったプロトコル パッケージ**: ご利用のプロバイダーに合った正しいエクスポーターをインストールしたか確認してください
2. **無効なエンドポイント**: エンドポイントの形式がプロバイダーの要件に合致しているか確認してください
3. **認証エラー**: API キーやヘッダーが正しいか確認してください
4. **トレースが表示されない**: トレースが完了しているか確認してください（ルートスパンを終了させる必要があります）

## 関連情報 \{#related\}

* [AI トレーシング概要](/docs/observability/ai-tracing/overview)
* [OpenTelemetry GenAI 仕様](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
* [OTEL エクスポーター リファレンス](/docs/reference/observability/ai-tracing/exporters/otel)