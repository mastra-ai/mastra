---
title: "BraintrustExporter "
description: AIトレース用のBraintrustエクスポーター
---

# BraintrustExporter \{#braintrustexporter\}

AI のトレースデータを Braintrust に送信して、評価と可観測性を実現します。

## コンストラクタ \{#constructor\}

```typescript
new BraintrustExporter(config: BraintrustExporterConfig)
```

## BraintrustExporterConfig \{#braintrustexporterconfig\}

```typescript
interface BraintrustExporterConfig {
  apiKey?: string;
  endpoint?: string;
  projectName?: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  tuningParameters?: Record<string, any>;
}
```

<PropertiesTable
  props={[
{
name: "apiKey",
type: "string",
description: "Braintrust の API キー",
required: false,
},
{
name: "endpoint",
type: "string",
description: "カスタム Braintrust エンドポイント",
required: false,
},
{
name: "projectName",
type: "string",
description: "プロジェクト名（既定値: 'mastra-tracing'）",
required: false,
},
{
name: "logLevel",
type: "'debug' | 'info' | 'warn' | 'error'",
description: "ログレベル（既定値: 'warn'）",
required: false,
},
{
name: "tuningParameters",
type: "Record<string, any>",
description: "Braintrust のチューニング用パラメータ",
required: false,
},
]}
/>

## 手法 \{#methods\}

### exportEvent \{#exportevent\}

```typescript
async exportEvent(event: AITracingEvent): Promise<void>
```

トレーシングイベントを Braintrust にエクスポートします。

### エクスポート \{#export\}

```typescript
async export(spans: ReadOnlyAISpan[]): Promise<void>
```

スパンをバッチで Braintrust にエクスポートします。

### シャットダウン \{#shutdown\}

```typescript
async shutdown(): Promise<void>
```

未処理のデータをフラッシュして、クライアントをシャットダウンします。

## 使用方法 \{#usage\}

```typescript
import { BraintrustExporter } from '@mastra/braintrust';

const exporter = new BraintrustExporter({
  apiKey: process.env.BRAINTRUST_API_KEY,
  projectName: 'my-ai-project',
});
```

## スパンタイプの対応表 \{#span-type-mapping\}

| AI スパンタイプ             | Braintrust のタイプ |
| --------------------------- | ------------------- |
| `LLM_GENERATION`            | `llm`               |
| `LLM_CHUNK`                 | `llm`               |
| `TOOL_CALL`                 | `tool`              |
| `MCP_TOOL_CALL`             | `tool`              |
| `WORKFLOW_CONDITIONAL_EVAL` | `function`          |
| `WORKFLOW_WAIT_EVENT`       | `function`          |
| その他                      | `task`              |