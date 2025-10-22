---
title: 'LangfuseExporter '
description: Langfuse exporter for AI tracing
---

# LangfuseExporter

Sends AI tracing data to Langfuse for observability.

## Constructor

```typescript
new LangfuseExporter(config: LangfuseExporterConfig)
```

## LangfuseExporterConfig

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
description: "Langfuse API key",
required: false,
},
{
name: "secretKey",
type: "string",
description: "Langfuse secret key",
required: false,
},
{
name: "baseUrl",
type: "string",
description: "Langfuse host URL",
required: false,
},
{
name: "realtime",
type: "boolean",
description: "Enable realtime mode - flushes after each event",
required: false,
},
{
name: "logLevel",
type: "'debug' | 'info' | 'warn' | 'error'",
description: "Logger level (default: 'warn')",
required: false,
},
{
name: "options",
type: "any",
description: "Additional Langfuse client options",
required: false,
},
]}
/>

## Methods

### exportEvent

```typescript
async exportEvent(event: AITracingEvent): Promise<void>
```

Exports a tracing event to Langfuse.

### export

```typescript
async export(spans: ReadOnlyAISpan[]): Promise<void>
```

Batch exports spans to Langfuse.

### shutdown

```typescript
async shutdown(): Promise<void>
```

Flushes pending data and shuts down the client.

## Usage

```typescript
import { LangfuseExporter } from '@mastra/langfuse';

const exporter = new LangfuseExporter({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: 'https://cloud.langfuse.com',
  realtime: true,
});
```

## Span Mapping

- Root spans → Langfuse traces
- `LLM_GENERATION` spans → Langfuse generations
- All other spans → Langfuse spans
- Event spans → Langfuse events
