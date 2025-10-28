---
title: "リファレンス：Keywords AI 連携"
description: Keywords AI（LLMアプリケーション向けのオブザーバビリティプラットフォーム）を Mastra と連携するためのドキュメント。
---

## Keywords AI \{#keywords-ai\}

[Keywords AI](https://docs.keywordsai.co/get-started/overview) は、開発者やPMが信頼性の高いAIプロダクトを素早く構築できるよう支援する、フルスタックのLLMエンジニアリングプラットフォームです。共有ワークスペースで、プロダクトチームはAIのパフォーマンスを構築・監視・改善できます。

このチュートリアルでは、[Mastra](https://mastra.ai/) と組み合わせてKeywords AIのトレーシングを設定し、AI搭載アプリケーションを監視・トレースする方法を紹介します。

すぐに始められるよう、あらかじめ用意されたサンプルもあります。コードは [GitHub](https://github.com/Keywords-AI/keywordsai-example-projects/tree/main/mastra-ai-weather-agent) で確認できます。

## セットアップ \{#setup\}

これは Mastra Weather Agent の例に関するチュートリアルです。

### 1. 依存関係をインストール \{#1-install-dependencies\}

```bash copy
pnpm をインストールする
```

### 2. 環境変数 \{#2-environment-variables\}

サンプルの環境ファイルをコピーし、API キーを追加します：

```bash copy
cp .env.local.example .env.local
```

.env.local を自分の認証情報で更新してください：

```bash .env.local copy
OPENAI_API_KEY=あなたの OpenAI API キー
KEYWORDSAI_API_KEY=あなたの Keywords AI の API キー
KEYWORDSAI_BASE_URL=https://api.keywordsai.co
```

### 3. Keywords AI のトレースを使って Mastra クライアントをセットアップする \{#3-setup-mastra-client-with-keywords-ai-tracing\}

`src/mastra/index.ts` で KeywordsAI のテレメトリーを構成します:

```typescript filename="src/mastra/index.ts" showLineNumbers copy

import { Mastra } from "@mastra/core/mastra";
import { KeywordsAIExporter } from "@keywordsai/exporter-vercel";

telemetry: {
  serviceName: "keywordai-mastra-example",
  enabled: true,
  export: {
    type: "custom",
    exporter: new KeywordsAIExporter({
      apiKey: process.env.KEYWORDSAI_API_KEY,
      baseUrl: process.env.KEYWORDSAI_BASE_URL,
      debug: true,
    })
  }
}
```

### 3. プロジェクトを実行 \{#3-run-the-project\}

```bash copy
mastra dev
```

これで Mastra のプレイグラウンドが開き、天気エージェントと対話できます。

## オブザーバビリティ \{#observability\}

設定が完了すると、[Keywords AI プラットフォーム](https://platform.keywordsai.co/platform/traces) でトレースやアナリティクスを確認できます。