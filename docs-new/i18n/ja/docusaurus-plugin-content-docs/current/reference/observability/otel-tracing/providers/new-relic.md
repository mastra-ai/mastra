---
title: "リファレンス: New Relic 連携"
description: Mastra と New Relic の統合に関するドキュメント。Mastra は OpenTelemetry に対応した、フルスタック監視向けの包括的な可観測性プラットフォームです。
---

# New Relic \{#new-relic\}

New Relic は、フルスタック監視に向けて OpenTelemetry（OTLP）をサポートする総合的な可観測性プラットフォームです。

## 設定 \{#configuration\}

OTLP 経由で Mastra と New Relic を使用するには、以下の環境変数を設定してください。

```env
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp.nr-data.net:4317
OTEL_EXPORTER_OTLP_HEADERS="api-key=ライセンスキー"
```

## 実装 \{#implementation\}

Mastra を New Relic で利用するための設定方法は次のとおりです。

```typescript
import { Mastra } from '@mastra/core';

export const mastra = new Mastra({
  // ... 他の設定
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

[one.newrelic.com](https://one.newrelic.com) の New Relic One ダッシュボードでテレメトリデータを確認します