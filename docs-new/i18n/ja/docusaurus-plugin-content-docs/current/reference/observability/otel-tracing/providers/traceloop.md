---
title: "リファレンス: Traceloop との統合"
description: Mastra（LLM アプリケーション向けの OpenTelemetry ネイティブな可観測性プラットフォーム）と Traceloop の統合に関するドキュメント。
---

# Traceloop \{#traceloop\}

Traceloopは、LLMアプリケーション向けに設計された、OpenTelemetryネイティブのオブザーバビリティプラットフォームです。

## 設定 \{#configuration\}

Mastra で Traceloop を使用するには、以下の環境変数を設定してください:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.traceloop.com
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer your_api_key, x-traceloop-destination-id=your_destination_id"
```

## 実装 \{#implementation\}

Mastra を Traceloop で使えるように設定する方法は次のとおりです。

```typescript
import { Mastra } from '@mastra/core';

export const mastra = new Mastra({
  // ... その他の設定
  telemetry: {
    serviceName: 'your-service-name',
    enabled: true,
    export: {
      type: 'otlp',
    },
  },
});
```

## ダッシュボード \{#dashboard\}

[app.traceloop.com](https://app.traceloop.com) の Traceloop ダッシュボードからトレースと分析にアクセスできます