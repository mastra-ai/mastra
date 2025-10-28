---
title: "OTEL トレーシング"
description: "Mastra アプリ向けに OpenTelemetry トレーシングを設定する"
---

# OTEL トレーシング \{#otel-tracing\}

Mastra は、アプリケーションのトレーシングとモニタリングに OpenTelemetry Protocol (OTLP) をサポートしています。テレメトリが有効になると、Mastra はエージェントの操作、LLM とのやり取り、ツールの実行、インテグレーション呼び出し、ワークフロー実行、データベース操作など、すべてのコアプリミティブを自動でトレースします。収集されたテレメトリデータは、任意の OTEL コレクターにエクスポートできます。

### 基本設定 \{#basic-configuration\}

テレメトリーを有効にする簡単な例は次のとおりです：

```ts filename="mastra.config.ts" showLineNumbers copy
export const mastra = new Mastra({
  // ... その他の設定
  telemetry: {
    serviceName: 'my-app',
    enabled: true,
    sampling: {
      type: 'always_on',
    },
    export: {
      type: 'otlp',
      endpoint: 'http://localhost:4318', // SigNoz のローカル エンドポイント
    },
  },
});
```

### 設定オプション \{#configuration-options\}

telemetry の設定では、次のプロパティを指定できます:

```ts
type OtelConfig = {
  // トレースでサービスを識別するための名前（任意）
  serviceName?: string;

  // テレメトリーの有効/無効を切り替える（デフォルトは true）
  enabled?: boolean;

  // 収集するトレースの割合を制御
  sampling?: {
    type: 'ratio' | 'always_on' | 'always_off' | 'parent_based';
    probability?: number; // 比率サンプリング用
    root?: {
      probability: number; // parent_based サンプリング用
    };
  };

  // テレメトリーデータの送信先
  export?: {
    type: 'otlp' | 'console';
    endpoint?: string;
    headers?: Record<string, string>;
  };
};
```

詳細は、[OtelConfig のリファレンスドキュメント](/docs/reference/observability/otel-tracing/otel-config)をご覧ください。

### 環境変数 \{#environment-variables\}

OTLP のエンドポイントとヘッダーは、環境変数で設定できます:

```env filename=".env" copy
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_EXPORTER_OTLP_HEADERS=x-api-key=your-api-key
```

次に、あなたのconfigで:

```ts filename="mastra.config.ts" showLineNumbers copy
export const mastra = new Mastra({
  // ... other config
  telemetry: {
    serviceName: 'my-app',
    enabled: true,
    export: {
      type: 'otlp',
      // エンドポイントとヘッダーは環境変数から取得されます
    },
  },
});
```

### 例: SigNoz との統合 \{#example-signoz-integration\}

[SigNoz](https://signoz.io) 上でのエージェントのトレースは次のように表示されます:

![スパン、LLM 呼び出し、ツール実行を示すエージェントのトレース](/img/signoz-telemetry-demo.png)

### その他の対応プロバイダー \{#other-supported-providers\}

対応しているオブザーバビリティプロバイダーとその構成の詳細については、[Observability Providers リファレンス](/docs/reference/observability/otel-tracing/providers/)をご覧ください。

### カスタムインストルメンテーションファイル \{#custom-instrumentation-files\}

Mastra プロジェクトでは、`/mastra` フォルダーに配置することでカスタムのインストルメンテーションファイルを定義できます。Mastra はこれらのファイルを自動的に検出してバンドルし、デフォルトのインストルメンテーションの代わりに使用します。

#### サポートされているファイルタイプ \{#supported-file-types\}

Mastra は、次の拡張子のインストルメンテーションファイルを探します：

* `instrumentation.js`
* `instrumentation.ts`
* `instrumentation.mjs`

#### 例 \{#example\}

```ts filename="/mastra/instrumentation.ts" showLineNumbers copy
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

Mastra がカスタムのインストルメンテーションファイルを検出すると、デフォルトのインストルメンテーションを自動的に置き換え、ビルド時にバンドルします。

### Mastra サーバー環境外でのトレース \{#tracing-outside-mastra-server-environment\}

`mastra start` または `mastra dev` コマンドを使用する場合、Mastra はトレースに必要なインストルメンテーションファイルを自動的に用意して読み込みます。ただし、Mastra サーバー環境の外で自分のアプリケーションの依存関係として Mastra を使用する場合は、インストルメンテーションファイルを手動で用意する必要があります。

この場合にトレースを有効化するには:

1. 設定で Mastra のテレメトリーを有効にします:

```typescript
export const mastra = new Mastra({
  telemetry: {
    enabled: true,
  },
});
```

2. プロジェクト内に計測用のファイル（例：`instrumentation.mjs`）を作成します：

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

3. OpenTelemetry の環境変数を追加する:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.braintrust.dev/otel
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer <APIキー>, x-bt-parent=project_name:<プロジェクト名>"
```

4. アプリケーションを起動する前に OpenTelemetry SDK を実行します：

```bash
node --import=./instrumentation.mjs --import=@opentelemetry/instrumentation/hook.mjs src/index.js
```

### Next.js 固有のトレーシング手順 \{#nextjs-specific-tracing-steps\}

Next.js を使用している場合は、追加で次の 3 つの設定手順があります：

1. `next.config.ts` で instrumentation hook を有効にする
2. Mastra のテレメトリー設定を行う
3. OpenTelemetry のエクスポーターを設定する

実装の詳細については、[Next.js Tracing](./nextjs-tracing) ガイドを参照してください。