---
title: "リファレンス: LangSmith 連携"
description: Mastra と LangSmith の統合に関するドキュメント。Mastra は、LLM アプリケーションのデバッグ、テスト、評価、監視のためのプラットフォームです。
---

# LangSmith \{#langsmith\}

LangSmith は、LLM アプリケーションのデバッグ、テスト、評価、監視のための LangChain のプラットフォームです。

> **注**: 現在、この統合はアプリケーション内の AI 関連の呼び出しのみをトレースします。その他のタイプの操作はテレメトリデータには含まれません。

## 設定 \{#configuration\}

Mastra で LangSmith を使用するには、以下の環境変数を設定する必要があります。

```env
LANGSMITH_TRACING=true
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_API_KEY=your-api-key
LANGSMITH_PROJECT=your-project-name
```

## 実装 \{#implementation\}

Mastra を LangSmith で使えるように設定する方法は次のとおりです：

```typescript
import { Mastra } from '@mastra/core';
import { AISDKExporter } from 'langsmith/vercel';

export const mastra = new Mastra({
  // ... その他の設定
  telemetry: {
    serviceName: 'サービス名',
    enabled: true,
    export: {
      type: 'custom',
      exporter: new AISDKExporter(),
    },
  },
});
```

## ダッシュボード \{#dashboard\}

LangSmith のダッシュボードからトレースと分析にアクセスできます: [smith.langchain.com](https://smith.langchain.com)

> **注**: ワークフローを実行しても、新規プロジェクトにデータが表示されない場合があります。すべてのプロジェクトを確認するには Name 列で並べ替え、対象のプロジェクトを選択してから、Root Runs ではなく LLM Calls で絞り込んでください。