# Mastra Observability

Tracing and monitoring for AI operations in Mastra.

## Installation

```bash
npm install @mastra/observability
```

## Quick Start

```typescript
import { Mastra } from '@mastra/core';
import { Observability, DefaultExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability';

export const mastra = new Mastra({
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'my-app',
        exporters: [
          new DefaultExporter(), // Persists traces for Mastra Studio
          new CloudExporter(), // Sends to Mastra Cloud
        ],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
});
```

## Features

- **Auto-instrumentation** - Traces agent runs, LLM calls, tool executions, and workflows
- **Pluggable Exporters** - Exporters for Studio and Cloud, plus integrations for Arize, Braintrust, Langfuse, LangSmith, and OpenTelemetry
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

## Metrics Labels

All metrics (both auto-extracted and user-emitted) use a consistent set of 8 labels:

| Label         | Description                                                                 | Cardinality                 |
| ------------- | --------------------------------------------------------------------------- | --------------------------- |
| `entity_type` | What is being measured (e.g., `agent`, `tool`, `workflow_run`)              | Small enum (~9 values)      |
| `entity_name` | Name of the entity (e.g., `researcher`, `search`)                           | Bounded by defined entities |
| `parent_type` | Entity type of the nearest parent                                           | Same small enum             |
| `parent_name` | Name of the nearest parent entity                                           | Bounded by defined entities |
| `root_type`   | Entity type of the outermost ancestor (only set when different from parent) | Same small enum             |
| `root_name`   | Name of the outermost ancestor entity                                       | Bounded by defined entities |
| `model`       | LLM model ID (only on model generation spans)                               | Bounded by LLM providers    |
| `provider`    | LLM provider (only on model generation spans)                               | Bounded by LLM providers    |

### Common query patterns

- **Which agent is expensive?** → group by `entity_name` where `entity_type=agent`
- **Why is this tool slow only sometimes?** → group by `parent_name`
- **What's the total cost of this user-facing flow?** → group by `root_name`
- **Which model is cheapest for this agent?** → group by `model` where `entity_name=X`

## Documentation

For configuration options, exporters, sampling strategies, and more, see the [full documentation](https://mastra.ai/docs/v1/observability/overview).
