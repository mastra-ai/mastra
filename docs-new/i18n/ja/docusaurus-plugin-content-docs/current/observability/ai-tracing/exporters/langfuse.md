---
title: "Langfuse Exporter"
description: "LLM の可観測性と分析のために、AI のトレースを Langfuse に送信する"
---

# Langfuse エクスポーター \{#langfuse-exporter\}

[Langfuse](https://langfuse.com/) は、LLM アプリケーション向けに特化したオープンソースの可観測性プラットフォームです。Langfuse エクスポーターは AI のトレースを Langfuse に送信し、モデルの性能、トークン使用量、会話フローに関する詳細な洞察を提供します。

## Langfuse を使うタイミング \{#when-to-use-langfuse\}

Langfuse は次のような場面に最適です:

* **LLM 向けの分析** - トークン使用量、コスト、レイテンシの内訳
* **会話の追跡** - セッション単位でのトレースのグルーピング
* **品質評価** - 手動・自動の評価スコア
* **モデル比較** - A/B テストやバージョン比較
* **セルフホスティング対応** - 自社インフラへのデプロイ

## インストール \{#installation\}

```bash npm2yarn
npm install @mastra/langfuse
```

## 設定 \{#configuration\}

### 前提条件 \{#prerequisites\}

1. **Langfuse アカウント**： [cloud.langfuse.com](https://cloud.langfuse.com) でサインアップするか、自前でデプロイする
2. **API キー**： Langfuse の Settings → API Keys で public/secret のキー ペアを作成
3. **環境変数**： 認証情報を設定

```bash filename=".env"
LANGFUSE_PUBLIC_KEY=pk-lf-xxxxxxxxxxxx
LANGFUSE_SECRET_KEY=sk-lf-xxxxxxxxxxxx
LANGFUSE_BASE_URL=https://cloud.langfuse.com  # またはセルフホストのURL
```

### 基本設定 \{#basic-setup\}

```typescript filename="src/mastra/index.ts"
import { Mastra } from '@mastra/core';
import { LangfuseExporter } from '@mastra/langfuse';

export const mastra = new Mastra({
  observability: {
    configs: {
      langfuse: {
            serviceName: 'my-service',
        exporters: [
          new LangfuseExporter({
            publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
            secretKey: process.env.LANGFUSE_SECRET_KEY!,
            baseUrl: process.env.LANGFUSE_BASE_URL,
            options: {
              environment: process.env.NODE_ENV,
            },
          }),
        ],
      },
    },
  },
});
```

## 設定オプション \{#configuration-options\}

### リアルタイムとバッチモード \{#realtime-vs-batch-mode\}

Langfuse エクスポーターは、トレース送信のために2つのモードに対応しています：

#### リアルタイムモード（開発） \{#realtime-mode-development\}

トレースは即座にLangfuseダッシュボードに表示され、デバッグに最適です。

```typescript
new LangfuseExporter({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  realtime: true, // 各イベント後にフラッシュする
});
```

#### バッチモード（本番環境） \{#batch-mode-production\}

自動バッチ処理でパフォーマンスが向上します：

```typescript
new LangfuseExporter({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  realtime: false, // 既定値 - トレースをバッチ処理します
});
```

### 完全な構成 \{#complete-configuration\}

```typescript
new LangfuseExporter({
  // 必須のクレデンシャル
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,

  // 任意の設定
  baseUrl: process.env.LANGFUSE_BASE_URL, // デフォルト: https://cloud.langfuse.com
  realtime: process.env.NODE_ENV === 'development', // モードを動的に選択
  logLevel: 'info', // 診断用ログ: debug | info | warn | error

  // Langfuse 固有のオプション
  options: {
    environment: process.env.NODE_ENV, // フィルタ用に UI に表示
    version: process.env.APP_VERSION, // バージョン差分を追跡
    release: process.env.GIT_COMMIT, // Git のコミットハッシュ
  },
});
```

## 関連事項 \{#related\}

* [AI トレーシング概要](/docs/observability/ai-tracing/overview)
* [Langfuse ドキュメント](https://langfuse.com/docs)