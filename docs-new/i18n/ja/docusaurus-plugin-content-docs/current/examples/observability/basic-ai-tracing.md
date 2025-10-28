---
title: "AIトレーシング入門"
description: MastraアプリでAIトレーシングを始めましょう
---

# AIトレーシングの基本例 \{#basic-ai-tracing-example\}

この例では、Mastra アプリケーションで、エージェントとワークフローを自動計測して AI トレーシングを基本的に設定する方法を示します。

## 前提条件 \{#prerequisites\}

* Mastra v0.14.0以上
* Node.js 18以上
* 設定済みのストレージバックエンド（libsql または memory）

## セットアップ \{#setup\}

### 1. 依存関係のインストール \{#1-install-dependencies\}

```bash npm2yarn
npm install @mastra/core
```

Mastra Cloudでトレースを表示するには、アクセス トークンを含む `.env` ファイルを作成してください。

```bash
export MASTRA_CLOUD_ACCESS_TOKEN=your_token_here
```

### 2. デフォルトのトレーシングで Mastra を設定する \{#2-configure-mastra-with-default-tracing\}

AI トレーシングを有効にした Mastra の設定を作成します：

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core';
import { LibSQLStorage } from '@mastra/libsql';

export const mastra = new Mastra({
  // ストレージの設定（DefaultExporterに必要）
  storage: new LibSQLStorage({
    url: 'file:local.db',
  }),

  // デフォルト設定でAIトレーシングを有効化
  observability: {
    default: { enabled: true },
  },
});
```

このデフォルト構成には自動的に次が含まれます:

* **[DefaultExporter](/docs/observability/ai-tracing/exporters/default)** - トレースをストレージに保存します
* **[CloudExporter](/docs/observability/ai-tracing/exporters/cloud)** - Mastra Cloud に送信します（トークンが設定されている場合）
* **[SensitiveDataFilter](/docs/observability/ai-tracing/processors/sensitive-data-filter)** - 機密フィールドをマスクします
* **[100% sampling](/docs/observability/ai-tracing/overview#always-sample)** - すべてのトレースを収集します

### 3. 自動トレースを有効にしたエージェントを作成する \{#3-create-an-agent-with-automatic-tracing\}

```typescript filename="src/mastra/agents/example-agent.ts" showLineNumbers copy
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { openai } from '@ai-sdk/openai';

// createToolを使用してツールを作成
const getCurrentTime = createTool({
  name: 'getCurrentTime',
  description: '現在時刻を取得',
  input: {},
  execute: async () => {
    // ツール呼び出しは自動的にトレースされます
    return { time: new Date().toISOString() };
  },
});

export const exampleAgent = new Agent({
  name: 'example-agent',
  instructions: 'あなたは親切なAIアシスタントです。',
  model: openai('gpt-4'),
  tools: {
    getCurrentTime,
  },
});
```

### 4. 実行してトレースを確認 \{#4-execute-and-view-traces\}

```typescript filename="src/example.ts" showLineNumbers copy
import { mastra } from './mastra';

async function main() {
  // エージェントを取得
  const agent = mastra.getAgent('example-agent');

  // エージェントを実行 - 自動的にトレースを作成
  const result = await agent.generate('今何時ですか?');

  console.log('エージェントの応答:', result.text);
  console.log('トレースID:', result.traceId);
  console.log('トレースを表示: http://localhost:3000/traces/' + result.traceId);
}

main().catch(console.error);
```

## どこがトレースされるか \{#what-gets-traced\}

この例を実行すると、Mastra は自動的に次のスパンを作成します：

1. **AGENT&#95;RUN** - エージェントの実行全体
2. **LLM&#95;GENERATION** - エージェント内のモデル実行
3. **TOOL&#95;CALL** - ツール実行

トレース階層の例：

```
AGENT_RUN (example-agent)
├── LLM_GENERATION (gpt-4) - モデルの入出力
├── TOOL_CALL (getCurrentTime) - ツール実行
```

## トレースの表示 \{#viewing-traces\}

Playground または Mastra Cloud で Observability ページに移動し、トレースをクリックします。各スパンをクリックすると、入力、出力、属性、メタデータも確認できます。

## カスタムメタデータの追加 \{#adding-custom-metadata\}

カスタムメタデータでトレースに付加情報を加えましょう:

```typescript filename="src/example-with-metadata.ts" showLineNumbers copy
const result = await agent.generate('What time is it?', {
  // トレースにカスタムメタデータを追加
  metadata: {
    userId: 'user_123',
    sessionId: 'session_abc',
    feature: 'time-query',
    environment: 'development',
  },
});
```

## 関連情報 \{#related\}

### ドキュメント \{#documentation\}

* [AI トレーシングの概要](/docs/observability/ai-tracing/overview) - トレーシングの完全ガイド
* [Sensitive Data Filter](/docs/observability/ai-tracing/processors/sensitive-data-filter) - 機密データのマスキング
* [Configuration Patterns](/docs/observability/ai-tracing/overview#common-configuration-patterns--troubleshooting) - ベストプラクティス

### 参考 \{#reference\}

* [Configuration](/docs/reference/observability/ai-tracing/configuration) - ObservabilityConfig API
* [Exporters](/docs/reference/observability/ai-tracing/exporters/default-exporter) - DefaultExporter の詳細
* [Span Types](/docs/reference/observability/ai-tracing/span) - Span のインターフェースとメソッド
* [AITracing Classes](/docs/reference/observability/ai-tracing/) - トレーシングのコアクラス