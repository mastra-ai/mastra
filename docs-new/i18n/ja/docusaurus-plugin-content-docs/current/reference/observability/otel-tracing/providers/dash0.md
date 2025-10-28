---
title: "リファレンス：Dash0 連携"
description: OpenTelemetry ネイティブの可観測性ソリューションである Dash0 と Mastra を統合するためのドキュメント。
---

# Dash0 \{#dash0\}

Dash0 は、OpenTelemetry ネイティブのオブザーバビリティソリューションで、フルスタックの監視を提供し、Perses や Prometheus などの他の CNCF プロジェクトとも統合できます。

## 設定 \{#configuration\}

Mastra で Dash0 を使用するには、以下の環境変数を設定します:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=https://ingress.<region>.dash0.com
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer <your-auth-token>, Dash0-Dataset=<任意のデータセット>
```

## 実装 \{#implementation\}

Mastra を Dash0 で使用するように設定する手順は次のとおりです：

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

[dash0.com](https://www.dash0.com/) で Dash0 のダッシュボードにアクセスし、[Dash0 Integration Hub](https://www.dash0.com/hub/integrations) で [Distributed Tracing](https://www.dash0.com/distributed-tracing) の追加の連携方法をご確認ください