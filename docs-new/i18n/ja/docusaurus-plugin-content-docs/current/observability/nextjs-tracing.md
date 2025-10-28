---
title: "Next.js のトレース"
description: "Next.js アプリケーションで OpenTelemetry のトレースを設定する"
---

# Next.js のトレーシング \{#nextjs-tracing\}

Next.js で OpenTelemetry のトレースを有効にするには、追加の設定が必要です。

### ステップ 1: Next.js の設定 \{#step-1-nextjs-configuration\}

まず、Next.js の設定でインストゥルメンテーションフックを有効にします:

```ts filename="next.config.ts" showLineNumbers copy
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    instrumentationHook: true, // Next.js 15 以降では不要
  },
};

export default nextConfig;
```

### ステップ 2: Mastra の設定 \{#step-2-mastra-configuration\}

Mastra インスタンスを構成します：

```typescript filename="mastra.config.ts" copy
import { Mastra } from '@mastra/core';

export const mastra = new Mastra({
  // ... そのほかの設定
  telemetry: {
    serviceName: 'プロジェクト名',
    enabled: true,
  },
});
```

### ステップ 3: プロバイダを設定する \{#step-3-configure-your-providers\}

Next.js を使用している場合、OpenTelemetry のインストルメンテーションを設定する方法は2つあります。

#### オプション 1: カスタムエクスポーターを使う \{#option-1-using-a-custom-exporter\}

プロバイダーをまたいで動作させるには、カスタムエクスポーターを設定します。

1. 必要な依存関係をインストールします（Langfuse を例に使用）:

```bash copy
npm install @opentelemetry/api langfuse-vercel
```

2. インストルメンテーション用ファイルを作成する：

```ts filename="instrumentation.ts" copy
import { NodeSDK, ATTR_SERVICE_NAME, resourceFromAttributes } from '@mastra/core/telemetry/otel-vendor';
import { LangfuseExporter } from 'langfuse-vercel';

export function register() {
  const exporter = new LangfuseExporter({
    // ...Langfuse の設定
  });

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'ai',
    }),
    traceExporter: exporter,
  });

  sdk.start();
}
```

#### オプション 2: Vercel の OpenTelemetry セットアップを使用する \{#option-2-using-vercels-otel-setup\}

Vercel にデプロイする場合は、Vercel の OpenTelemetry セットアップを利用できます。

1. 必要な依存関係をインストールします:

```bash copy
npm install @opentelemetry/api @vercel/otel
```

2. プロジェクトのルート（または使用している場合は src フォルダー）に instrumentation ファイルを作成します:

```ts filename="instrumentation.ts" copy
import { registerOTel } from '@vercel/otel';

export function register() {
  registerOTel({ serviceName: 'your-project-name' });
}
```

### まとめ \{#summary\}

このセットアップにより、Next.js アプリケーションと Mastra の各種処理で OpenTelemetry のトレーシングが有効になります。

詳しくは、次のドキュメントをご覧ください：

* [Next.js Instrumentation](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation)
* [Vercel OpenTelemetry](https://vercel.com/docs/observability/otel-overview/quickstart)