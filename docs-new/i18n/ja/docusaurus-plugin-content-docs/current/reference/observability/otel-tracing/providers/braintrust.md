---
title: "リファレンス: Braintrust"
description: LLM アプリケーション向けの評価・監視プラットフォームである Mastra と Braintrust の統合に関するドキュメント。
---

# Braintrust \{#braintrust\}

Braintrust は、LLM アプリケーション向けの評価・モニタリングプラットフォームです。

## 設定 \{#configuration\}

Mastra で Braintrust を使用するには、以下の環境変数を設定してください:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.braintrust.dev/otel
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer <APIキー>, x-bt-parent=project_id:<プロジェクトID>"
```

## 実装 \{#implementation\}

Mastra を Braintrust で使うための設定方法は次のとおりです。

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

Braintrust のダッシュボードには [braintrust.dev](https://www.braintrust.dev/) からアクセスできます