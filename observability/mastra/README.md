# Mastra Observability

Tracing and monitoring for AI operations in Mastra.

## Installation

```bash
npm install @mastra/observability
```

## Quick Start

```typescript
import { Mastra } from '@mastra/core';
import {
  Observability,
  DefaultExporter,
  CloudExporter,
  SensitiveDataFilter,
} from '@mastra/observability';

export const mastra = new Mastra({
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'my-app',
        exporters: [
          new DefaultExporter(),   // Persists traces for Mastra Studio
          new CloudExporter(),     // Sends to Mastra Cloud
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(),
        ],
      },
    },
  }),
});
```

## Features

- **Auto-instrumentation** - Traces agent runs, LLM calls, tool executions, and workflows
- **Pluggable Exporters** - Built-in support for Studio and Cloud, plus integrations for Arize, Braintrust, Langfuse, LangSmith, and OpenTelemetry
- **Sampling Strategies** - Always, ratio-based, or custom sampling
- **Span Processors** - Transform or filter span data before export
- **OpenTelemetry Compatible** - Standard trace/span ID formats for integration

## Span Types

- `WORKFLOW_RUN` - Workflow execution
- `WORKFLOW_STEP` - Individual workflow step
- `AGENT_RUN` - Agent processing
- `MODEL_GENERATION` - LLM API calls
- `TOOL_CALL` - Tool execution
- `MCP_TOOL_CALL` - MCP tool execution
- `PROCESSOR_RUN` - Processor execution
- `GENERIC` - Custom operations

## Documentation

For configuration options, exporters, sampling strategies, and more, see the [full documentation](https://mastra.ai/docs/v1/observability/overview).
