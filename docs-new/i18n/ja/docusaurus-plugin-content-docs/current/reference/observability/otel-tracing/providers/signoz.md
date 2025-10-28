---
title: "リファレンス: SigNoz 連携"
description: Mastra と SigNoz の連携方法に関するドキュメント。SigNoz は OpenTelemetry を用いてフルスタックの監視を提供する、オープンソースの APM／オブザーバビリティ・プラットフォームです。
---

# SigNoz \{#signoz\}

SigNozは、OpenTelemetryを活用してフルスタックの監視機能を提供する、オープンソースのAPM兼オブザーバビリティプラットフォームです。

## 設定 \{#configuration\}

Mastra で SigNoz を使用するには、次の環境変数を設定してください:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.{region}.signoz.cloud:443
OTEL_EXPORTER_OTLP_HEADERS=signoz-ingestion-key=your_signoz_token
```

## 実装 \{#implementation\}

Mastra を SigNoz で利用するための設定手順は次のとおりです：

```typescript
import { Mastra } from '@mastra/core';

export const mastra = new Mastra({
  // ... その他の設定
  telemetry: {
    serviceName: 'サービス名',
    enabled: true,
    export: {
      type: 'otlp',
    },
  },
});
```

## ダッシュボード \{#dashboard\}

[signoz.io](https://signoz.io/) で SigNoz のダッシュボードにアクセスできます