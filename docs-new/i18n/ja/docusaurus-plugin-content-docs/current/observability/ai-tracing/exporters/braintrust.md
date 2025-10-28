---
title: "Braintrust Exporter"
description: "AIトレースをBraintrustに送信して評価とモニタリングを行う"
---

# Braintrust エクスポーター \{#braintrust-exporter\}

[Braintrust](https://www.braintrust.dev/) は、LLM アプリケーションの品質を測定・改善するための評価・監視プラットフォームです。Braintrust エクスポーターは AI のトレースを Braintrust に送信し、体系的な評価、スコアリング、実験を可能にします。

## Braintrust を使うべきタイミング \{#when-to-use-braintrust\}

Braintrust が真価を発揮する場面:

* **評価ワークフロー** - 品質を体系的に評価
* **実験トラッキング** - モデルのバージョンやプロンプトを比較
* **データセット管理** - テストケースやゴールドデータセットを整備
* **リグレッションテスト** - 改善で既存機能が損なわれないことを確認
* **チームコラボレーション** - 実験結果や知見を共有

## インストール \{#installation\}

```bash npm2yarn
npm install @mastra/braintrust
```

## 設定 \{#configuration\}

### 前提条件 \{#prerequisites\}

1. **Braintrust アカウント**: [braintrust.dev](https://www.braintrust.dev/) で登録
2. **プロジェクト**: トレース用のプロジェクトを作成または選択
3. **API キー**: Braintrust の設定 → API Keys で生成
4. **環境変数**: 認証情報を設定:

```bash filename=".env"
BRAINTRUST_API_KEY=sk-xxxxxxxxxxxxxxxx
BRAINTRUST_PROJECT_NAME=my-project  # オプション。デフォルトは 'mastra-tracing'
```

### 基本的な設定 \{#basic-setup\}

```typescript filename="src/mastra/index.ts"
import { Mastra } from '@mastra/core';
import { BraintrustExporter } from '@mastra/braintrust';

export const mastra = new Mastra({
  observability: {
    configs: {
      braintrust: {
        serviceName: 'my-service',
        exporters: [
          new BraintrustExporter({
            apiKey: process.env.BRAINTRUST_API_KEY,
            projectName: process.env.BRAINTRUST_PROJECT_NAME,
          }),
        ],
      },
    },
  },
});
```

### 完全な設定 \{#complete-configuration\}

```typescript
new BraintrustExporter({
  // 必須
  apiKey: process.env.BRAINTRUST_API_KEY!,

  // オプション設定
  projectName: 'my-project', // デフォルト: 'mastra-tracing'
  endpoint: 'https://api.braintrust.dev', // 必要に応じてカスタムエンドポイントを指定
  logLevel: 'info', // 診断ログレベル: debug | info | warn | error
});
```

## 関連 \{#related\}

* [AI トレーシングの概要](/docs/observability/ai-tracing/overview)
* [Braintrust ドキュメント](https://www.braintrust.dev/docs)