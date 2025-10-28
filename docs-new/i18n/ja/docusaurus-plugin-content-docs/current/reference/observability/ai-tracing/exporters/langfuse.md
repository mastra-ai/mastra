---
title: "LangfuseExporter"
description: AIトレーシング用のLangfuseエクスポーター
---

# LangfuseExporter \{#langfuseexporter\}

可観測性向上のために、AI のトレーシングデータを Langfuse に送信します。

## コンストラクタ \{#constructor\}

```typescript
new LangfuseExporter(config: LangfuseExporterConfig)
```

## LangfuseExporterConfig \{#langfuseexporterconfig\}

```typescript
interface LangfuseExporterConfig {
  publicKey?: string;
  secretKey?: string;
  baseUrl?: string;
  realtime?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  options?: any;
}
```

<PropertiesTable
  props={[
{
name: "publicKey",
type: "string",
description: "Langfuse の API キー",
required: false,
},
{
name: "secretKey",
type: "string",
description: "Langfuse のシークレットキー",
required: false,
},
{
name: "baseUrl",
type: "string",
description: "Langfuse のホスト URL",
required: false,
},
{
name: "realtime",
type: "boolean",
description: "リアルタイムモードを有効化 — 各イベント後にフラッシュします",
required: false,
},
{
name: "logLevel",
type: "'debug' | 'info' | 'warn' | 'error'",
description: "ログレベル（既定値: 'warn'）",
required: false,
},
{
name: "options",
type: "any",
description: "Langfuse クライアントの追加オプション",
required: false,
},
]}
/>

## 手法 \{#methods\}

### exportEvent \{#exportevent\}

```typescript
async exportEvent(event: AITracingEvent): Promise<void>
```

トレーシングイベントを Langfuse にエクスポートします。

### エクスポート \{#export\}

```typescript
async export(spans: ReadOnlyAISpan[]): Promise<void>
```

スパンをバッチでLangfuseにエクスポートします。

### シャットダウン \{#shutdown\}

```typescript
async shutdown(): Promise<void>
```

保留中のデータをフラッシュしてから、クライアントをシャットダウンします。

## 使い方 \{#usage\}

```typescript
import { LangfuseExporter } from '@mastra/langfuse';

const exporter = new LangfuseExporter({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: 'https://cloud.langfuse.com',
  realtime: true,
});
```

## スパンのマッピング \{#span-mapping\}

* ルートスパン → Langfuse のトレース
* `LLM_GENERATION` スパン → Langfuse のジェネレーション
* 上記以外のスパン → Langfuse のスパン
* イベントスパン → Langfuse のイベント