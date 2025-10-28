---
title: "リファレンス: Laminar との統合"
description: LLM アプリ向けのオブザーバビリティ特化型プラットフォームである Mastra と Laminar を統合するためのドキュメント。
---

# Laminar \{#laminar\}

Laminarは、LLMアプリケーション向けの特化型オブザーバビリティプラットフォームです。

## 設定 \{#configuration\}

Mastra で Laminar を使用するには、以下の環境変数を設定します。

```env
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.lmnr.ai:8443
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer your_api_key, x-laminar-team-id=your_team_id"
```

## 実装 \{#implementation\}

Mastra を Laminar で使用するように設定する方法は次のとおりです。

```typescript
import { Mastra } from '@mastra/core';

export const mastra = new Mastra({
  // ... そのほかの設定
  telemetry: {
    serviceName: 'サービス名'
    enabled: true,
    export: {
      type: 'otlp',
      protocol: 'grpc',
    },
  },
});
```

## ダッシュボード \{#dashboard\}

Laminar のダッシュボードには [https://lmnr.ai/](https://lmnr.ai/) からアクセスできます。