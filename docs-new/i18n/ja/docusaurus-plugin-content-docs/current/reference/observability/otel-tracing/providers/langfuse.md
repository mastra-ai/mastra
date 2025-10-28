---
title: "リファレンス: Langfuse との統合"
description: Mastra と Langfuse の統合方法を解説するドキュメント。Mastra は LLM アプリケーション向けのオープンソースの可観測性プラットフォームです。
---

# Langfuse \{#langfuse\}

Langfuseは、LLMアプリケーション向けに設計されたオープンソースの可観測性プラットフォームです。

> **注**: 現在、詳細なテレメトリーデータが含まれるのはAI関連の呼び出しのみです。その他の操作でもトレースは作成されますが、情報は限定的です。

## 設定 \{#configuration\}

Mastra で Langfuse を使用するには、環境変数で設定するか、Mastra の設定ファイルで直接指定できます。

### 環境変数の使用 \{#using-environment-variables\}

次の環境変数を設定します：

```env
OTEL_EXPORTER_OTLP_ENDPOINT="https://cloud.langfuse.com/api/public/otel/v1/traces" # EUデータリージョン
# OTEL_EXPORTER_OTLP_ENDPOINT="https://us.cloud.langfuse.com/api/public/otel/v1/traces" # USデータリージョン

OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic ${AUTH_STRING}"
```

`AUTH_STRING` は、公開鍵と秘密鍵を組み合わせて base64 エンコードした文字列です（以下参照）。

### AUTH&#95;STRING の生成 \{#generating-auth&#95;string\}

認証は Langfuse の API キーを用いた Basic 認証を使用します。以下の方法で、Base64 エンコード済みの認証文字列を生成できます:

```bash
echo -n "pk-lf-1234567890:sk-lf-1234567890" | base64
```

GNU システムで長い API キーを扱う場合は、自動折り返しを防ぐために `-w 0` を追加する必要があることがあります：

```bash
echo -n "pk-lf-1234567890:sk-lf-1234567890" | base64 -w 0
```

## 実装 \{#implementation\}

Mastra を OpenTelemetry と併用して Langfuse を使えるように設定する方法は次のとおりです：

```typescript
import { Mastra } from '@mastra/core';

export const mastra = new Mastra({
  // ... その他の設定
  telemetry: {
    enabled: true,
    export: {
      type: 'otlp',
      endpoint: 'https://cloud.langfuse.com/api/public/otel/v1/traces', // または任意のエンドポイント
      headers: {
        Authorization: `Basic ${AUTH_STRING}`, // Base64エンコードされた認証文字列
      },
    },
  },
});
```

また、環境変数を使用している場合は、設定を簡略化できます：

```typescript
import { Mastra } from '@mastra/core';

export const mastra = new Mastra({
  // ... その他の設定
  telemetry: {
    enabled: true,
    export: {
      type: 'otlp',
      // エンドポイントとヘッダーは OTEL_EXPORTER_OTLP_* 環境変数から読み込まれます
    },
  },
});
```

## ダッシュボード \{#dashboard\}

設定が完了すると、[cloud.langfuse.com](https://cloud.langfuse.com) の Langfuse ダッシュボードでトレースと分析を確認できます