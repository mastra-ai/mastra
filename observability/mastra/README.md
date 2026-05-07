# Mastra Observability

Tracing, metrics, and structured logging for AI operations in Mastra.

## Installation

```bash
npm install @mastra/observability
```

## Quick Start

```typescript
import { Mastra } from '@mastra/core';
import { Observability, DefaultExporter, CloudExporter } from '@mastra/observability';

export const mastra = new Mastra({
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'my-app',
        exporters: [
          new DefaultExporter(), // Persists traces for Mastra Studio
          new CloudExporter(), // Sends to Mastra platform
        ],
      },
    },
  }),
});
```

A `SensitiveDataFilter` span output processor is auto-applied to every configured instance by default, redacting secrets (API keys, tokens, passwords, etc.) before they reach exporters. Set `sensitiveDataFilter: false` on the `Observability` config to opt out, or pass a `SensitiveDataFilterOptions` object to customize it.

## Features

- **Auto-instrumentation** - Traces agent runs, LLM calls, tool executions, and workflows
- **Pluggable Exporters** - Exporters for Studio, plus integrations for Arize, Braintrust, Langfuse, LangSmith, and OpenTelemetry
- **Sampling Strategies** - Always, ratio-based, or custom sampling
- **Span Processors** - Transform or filter span data before export
- **OpenTelemetry Compatible** - Standard trace/span ID formats for integration

## Architecture

### ObservabilityBus

Central event router that dispatches tracing, metric, and log events to registered exporters. All handler promises are tracked for reliable flush and shutdown — no events are silently dropped.

Exporters register via `registerExporter()` and can optionally implement `onLogEvent` and `onMetricEvent` handlers alongside the existing `exportTracingEvent`.

### Auto-extracted metrics

Metrics are automatically extracted from span lifecycle events by `AutoExtractedMetrics`:

- `mastra_agent_duration_ms`
- `mastra_tool_duration_ms`
- `mastra_workflow_duration_ms`
- `mastra_model_duration_ms`
- `mastra_model_total_input_tokens` / `mastra_model_total_output_tokens`
- `mastra_model_input_text_tokens` / `mastra_model_input_cache_read_tokens` / `mastra_model_input_cache_write_tokens` / `mastra_model_input_audio_tokens` / `mastra_model_input_image_tokens`
- `mastra_model_output_text_tokens` / `mastra_model_output_reasoning_tokens` / `mastra_model_output_audio_tokens` / `mastra_model_output_image_tokens`

Auto-extracted metrics carry labels: `entity_type`, `entity_name`, `status`, plus `model` and `provider` on model generation spans.

### Structured logging

`LoggerContextImpl` emits log events with automatic trace correlation (traceId, spanId), inherited tags, and entity metadata. Supports minimum log level filtering (debug/info/warn/error/fatal).

### Metrics context

`MetricsContextImpl` provides counter, gauge, and histogram instruments. All labels pass through a `CardinalityFilter` that blocks high-cardinality keys (trace_id, user_id, etc.) to protect metric backends.

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

### Auto-extracted metric labels

| Label         | Description                                                          | Cardinality                 |
| ------------- | -------------------------------------------------------------------- | --------------------------- |
| `entity_type` | What is being measured (e.g., `agent`, `tool`, `workflow_run`)       | Small enum (~9 values)      |
| `entity_name` | Name of the entity (e.g., `researcher`, `search`)                    | Bounded by defined entities |
| `model`       | LLM model ID (only on model generation spans)                        | Bounded by LLM providers    |
| `provider`    | LLM provider (only on model generation spans)                        | Bounded by LLM providers    |
| `status`      | Outcome of the operation (`ok` or `error`), on `_ended` metrics only | 2 values                    |

### User-emitted metric labels (via MetricsContext)

User-emitted metrics inherit additional context labels from the active span:

| Label          | Description                                                                 | Cardinality                 |
| -------------- | --------------------------------------------------------------------------- | --------------------------- |
| `parent_type`  | Entity type of the nearest parent                                           | Same small enum             |
| `parent_name`  | Name of the nearest parent entity                                           | Bounded by defined entities |
| `root_type`    | Entity type of the outermost ancestor (only set when different from parent) | Same small enum             |
| `root_name`    | Name of the outermost ancestor entity                                       | Bounded by defined entities |
| `service_name` | Service name from observability config                                      | Single value per deployment |

### Common query patterns

- **Which agent is expensive?** → group by `entity_name` where `entity_type=agent`
- **Why is this tool slow only sometimes?** → group by `parent_name`
- **What's the total cost of this user-facing flow?** → group by `root_name`
- **Which model is cheapest for this agent?** → group by `model` where `entity_name=X`

## Documentation

For configuration options, exporters, sampling strategies, and more, see the [full documentation](https://mastra.ai/docs/v1/observability/overview).
