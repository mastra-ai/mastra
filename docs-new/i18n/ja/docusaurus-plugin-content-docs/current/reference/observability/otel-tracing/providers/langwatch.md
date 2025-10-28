---
title: "リファレンス: LangWatch との統合"
description: LLM アプリ向けの観測性プラットフォームである Mastra と LangWatch を統合するためのドキュメントです。
---

# LangWatch \{#langwatch\}

LangWatchは、LLMアプリケーション向けの専用オブザーバビリティ・プラットフォームです。

## 設定 \{#configuration\}

Mastra で LangWatch を使うには、次の環境変数を設定してください。

```env
LANGWATCH_API_KEY=your_api_key
```

## 実装 \{#implementation\}

Mastra を LangWatch で利用できるように設定する方法は次のとおりです：

```typescript
import { Mastra } from '@mastra/core';
import { LangWatchExporter } from 'langwatch';

export const mastra = new Mastra({
  // ... その他の設定
  telemetry: {
    serviceName: 'ai', // LangWatchExporter がこれを AI SDK のトレースとして認識するよう、必ず "ai" に設定してください
    enabled: true,
    export: {
      type: 'custom',
      exporter: new LangWatchExporter({
        apiKey: process.env.LANGWATCH_API_KEY,
      }),
    },
  },
});
```

## ダッシュボード \{#dashboard\}

[app.langwatch.ai](https://app.langwatch.ai) から LangWatch のダッシュボードにアクセスできます