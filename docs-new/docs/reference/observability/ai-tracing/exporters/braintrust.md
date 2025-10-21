---
title: "BraintrustExporter "
description: Braintrust exporter for AI tracing
---


# BraintrustExporter

Sends AI tracing data to Braintrust for eval and observability.

## Constructor

```typescript
new BraintrustExporter(config: BraintrustExporterConfig)
```

## BraintrustExporterConfig

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
      description: "Braintrust API key",
      required: false,
    },
    {
      name: "endpoint",
      type: "string",
      description: "Custom Braintrust endpoint",
      required: false,
    },
    {
      name: "projectName",
      type: "string",
      description: "Project name (default: 'mastra-tracing')",
      required: false,
    },
    {
      name: "logLevel",
      type: "'debug' | 'info' | 'warn' | 'error'",
      description: "Logger level (default: 'warn')",
      required: false,
    },
    {
      name: "tuningParameters",
      type: "Record<string, any>",
      description: "Tuning parameters for Braintrust",
      required: false,
    },
  ]}
/>

## Methods

### exportEvent

```typescript
async exportEvent(event: AITracingEvent): Promise<void>
```

Exports a tracing event to Braintrust.

### export

```typescript
async export(spans: ReadOnlyAISpan[]): Promise<void>
```

Batch exports spans to Braintrust.

### shutdown

```typescript
async shutdown(): Promise<void>
```

Flushes pending data and shuts down the client.

## Usage

```typescript
import { BraintrustExporter } from '@mastra/braintrust';

const exporter = new BraintrustExporter({
  apiKey: process.env.BRAINTRUST_API_KEY,
  projectName: 'my-ai-project',
});
```

## Span Type Mapping

| AI Span Type | Braintrust Type |
|--------------|-----------------|
| `LLM_GENERATION` | `llm` |
| `LLM_CHUNK` | `llm` |
| `TOOL_CALL` | `tool` |
| `MCP_TOOL_CALL` | `tool` |
| `WORKFLOW_CONDITIONAL_EVAL` | `function` |
| `WORKFLOW_WAIT_EVENT` | `function` |
| All others | `task` |