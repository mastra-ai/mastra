---
title: "LangSmithExporter"
description: AIトレース向けのLangSmithエクスポーター
---

# LangSmithExporter \{#langsmithexporter\}

可観測性のために、AI のトレースデータを LangSmith に送信します。

## コンストラクタ \{#constructor\}

```typescript
new LangSmithExporter(config: LangSmithExporterConfig)
```

## LangSmithエクスポーター設定 \{#langsmithexporterconfig\}

```typescript
interface LangSmithExporterConfig extends ClientConfig {
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  client?: Client;
}
```

<PropertiesTable
  props={[
{
name: "apiKey",
type: "string",
description: "LangSmith APIキー",
required: false,
},
{
name: "apiUrl",
type: "string",
description: "LangSmith APIのURL",
required: false,
},
{
name: "callerOptions",
type: "object",
description: "HTTPクライアントの設定オプション",
required: false,
},
{
name: "hideInputs",
type: "boolean",
description: "LangSmithのUIで入力データを非表示にする",
required: false,
},
{
name: "hideOutputs",
type: "boolean",
description: "LangSmithのUIで出力データを非表示にする",
required: false,
},
{
name: "logLevel",
type: "'debug' | 'info' | 'warn' | 'error'",
description: "ログレベル（デフォルト: 'warn'）",
required: false,
},
{
name: "client",
type: "Client",
description: "事前設定済みのLangSmithクライアントインスタンス",
required: false,
},
]}
/>

## 方法 \{#methods\}

### exportEvent \{#exportevent\}

```typescript
async exportEvent(event: AITracingEvent): Promise<void>
```

トレースイベントを LangSmith にエクスポートします。

### シャットダウン \{#shutdown\}

```typescript
async shutdown(): Promise<void>
```

すべてのアクティブなスパンを終了し、トレースマップを消去します。

## 使い方 \{#usage\}

```typescript
import { LangSmithExporter } from '@mastra/langsmith';

const exporter = new LangSmithExporter({
  apiKey: process.env.LANGSMITH_API_KEY,
  apiUrl: 'https://api.smith.langchain.com',
  logLevel: 'info',
});
```

## スパンタイプのマッピング \{#span-type-mapping\}

| AI のスパンタイプ | LangSmith のタイプ |
| ---------------- | ------------------ |
| `LLM_GENERATION` | `llm`              |
| `LLM_CHUNK`      | `llm`              |
| `TOOL_CALL`      | `tool`             |
| `MCP_TOOL_CALL`  | `tool`             |
| その他           | `chain`            |