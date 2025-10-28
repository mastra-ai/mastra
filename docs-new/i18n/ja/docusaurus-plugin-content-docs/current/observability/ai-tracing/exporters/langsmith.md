---
title: "LangSmith エクスポーター"
description: "LLM の可観測性と評価のために、AI のトレースを LangSmith に送信する"
---

# LangSmith Exporter \{#langsmith-exporter\}

[LangSmith](https://smith.langchain.com/) は、LLM アプリケーションの監視と評価のための LangChain のプラットフォームです。LangSmith エクスポーターは AI のトレースを LangSmith に送信し、モデル性能の可視化、デバッグ、評価ワークフローを支援します。

## LangSmith を使うタイミング \{#when-to-use-langsmith\}

LangSmith は次のような場合に最適です:

* **LangChain エコシステムとの統合** - LangChain アプリケーションをネイティブにサポート
* **デバッグとテスト** - 詳細なトレースの可視化とリプレイ
* **評価パイプライン** - 評価とデータセット管理の機能を標準搭載
* **プロンプトのバージョン管理** - プロンプトのバリエーションを追跡・比較
* **コラボレーション機能** - チームワークスペースと共有プロジェクト

## インストール \{#installation\}

```bash npm2yarn
npm install @mastra/langsmith
```

## 設定 \{#configuration\}

### 前提条件 \{#prerequisites\}

1. **LangSmith アカウント**: [smith.langchain.com](https://smith.langchain.com) で登録する
2. **API キー**: LangSmith の Settings → API Keys で API キーを作成する
3. **環境変数**: 資格情報を環境変数に設定する

```bash filename=".env"
LANGSMITH_API_KEY=ls-xxxxxxxxxxxx
LANGSMITH_BASE_URL=https://api.smith.langchain.com  # セルフホスト環境では省略可能
```

### 基本設定 \{#basic-setup\}

```typescript filename="src/mastra/index.ts"
import { Mastra } from '@mastra/core';
import { LangSmithExporter } from '@mastra/langsmith';

export const mastra = new Mastra({
  observability: {
    configs: {
      langsmith: {
        serviceName: 'my-service',
        exporters: [
          new LangSmithExporter({
            apiKey: process.env.LANGSMITH_API_KEY,
          }),
        ],
      },
    },
  },
});
```

## 設定項目 \{#configuration-options\}

### 完全な構成 \{#complete-configuration\}

```typescript
new LangSmithExporter({
  // 必須の認証情報
  apiKey: process.env.LANGSMITH_API_KEY!,

  // オプション設定
  apiUrl: process.env.LANGSMITH_BASE_URL, // デフォルト: https://api.smith.langchain.com
  callerOptions: {
    // HTTPクライアントオプション
    timeout: 30000, // リクエストタイムアウト(ミリ秒)
    maxRetries: 3, // 再試行回数
  },
  logLevel: 'info', // 診断ログ: debug | info | warn | error

  // LangSmith固有のオプション
  hideInputs: false, // UIで入力データを非表示
  hideOutputs: false, // UIで出力データを非表示
});
```

## 関連情報 \{#related\}

* [AI トレーシングの概要](/docs/observability/ai-tracing/overview)
* [LangSmith のドキュメント](https://docs.smith.langchain.com/)