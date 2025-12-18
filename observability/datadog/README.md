# @mastra/datadog

Datadog LLM Observability exporter for Mastra. Exports observability data to [Datadog's LLM Observability](https://docs.datadoghq.com/llm_observability/) product.

## Installation

```bash
pnpm add @mastra/datadog
```

## Requirements

- Datadog account with LLM Observability enabled
- Datadog API key (available in your Datadog account settings)

## Usage

### Basic Setup

```typescript
import { Mastra } from '@mastra/core';
import { DatadogExporter } from '@mastra/datadog';

const datadog = new DatadogExporter({
  mlApp: 'my-llm-app',
  apiKey: process.env.DD_API_KEY,
});

const mastra = new Mastra({
  observability: {
    configs: {
      default: {
        serviceName: 'my-service',
        exporters: [datadog],
      },
    },
  },
});
```

### With Local Datadog Agent (Optional)

If you have a Datadog Agent running locally, you can use agent mode instead:

```typescript
const datadog = new DatadogExporter({
  mlApp: 'my-llm-app',
  agentless: false, // Use local Datadog Agent instead of direct HTTPS
  env: 'production',
});
```

### Configuration Options

| Option                | Description                                          | Default                        |
| --------------------- | ---------------------------------------------------- | ------------------------------ |
| `apiKey`              | Datadog API key (required)                           | `DD_API_KEY` env var           |
| `mlApp`               | ML application name for grouping traces (required)   | `DD_LLMOBS_ML_APP` env var     |
| `site`                | Datadog site (e.g., 'datadoghq.com', 'datadoghq.eu') | `DD_SITE` or `'datadoghq.com'` |
| `agentless`           | Use direct HTTPS intake (no local agent required)    | `true`                         |
| `service`             | Service name for the application                     | Uses `mlApp` value             |
| `env`                 | Environment name (e.g., 'production', 'staging')     | `DD_ENV` env var               |
| `integrationsEnabled` | Enable dd-trace automatic integrations               | `false`                        |
| `defaultUserId`       | Default user ID for all spans                        | (none)                         |
| `defaultSessionId`    | Default session ID for all spans                     | (none)                         |

Note that the `site` is also used to specify non-default regions, e.g. `us3.datadoghq.com` instead of `us1.datadoghq.com`.

### Environment Variables

The exporter reads configuration from environment variables:

- `DD_API_KEY` - Datadog API key (required)
- `DD_LLMOBS_ML_APP` - ML application name
- `DD_SITE` - Datadog site
- `DD_ENV` - Environment name
- `DD_LLMOBS_AGENTLESS_ENABLED` - Set to 'false' or '0' to use local Datadog Agent

## Span Type Mapping

Mastra span types are mapped to Datadog LLMObs span kinds:

| Mastra SpanType      | Datadog Kind |
| -------------------- | ------------ |
| `AGENT_RUN`          | `agent`      |
| `MODEL_GENERATION`   | `llm`        |
| `MODEL_STEP`         | `llm`        |
| `MODEL_CHUNK`        | `task`       |
| `TOOL_CALL`          | `tool`       |
| `MCP_TOOL_CALL`      | `tool`       |
| `WORKFLOW_RUN`       | `workflow`   |
| `WORKFLOW_STEP`      | `task`       |
| Other workflow types | `task`       |
| `GENERIC`            | `task`       |

## Features

- **Completion-only pattern**: Spans are emitted at completion for efficient tracing
- **Message formatting**: LLM inputs/outputs formatted as message arrays
- **Metadata as tags**: Span metadata is flattened into searchable Datadog tags
- **Error tracking**: Error spans include error tags with message, ID, and category
- **Evaluation scoring**: Submit scores via `addScoreToTrace()` method
- **Parent/child hierarchy**: Spans are emitted parent-first to preserve trace trees in Datadog

## Evaluation Scoring

Submit evaluation scores for traces:

```typescript
await datadog.addScoreToTrace({
  traceId: 'trace-123',
  spanId: 'span-456',
  score: 0.95,
  reason: 'Response was accurate and helpful',
  scorerName: 'quality_scorer',
  metadata: { category: 'helpfulness' },
});
```

Notes:

- Evaluations attach to spans only after the span has been emitted (on `span_ended`).
- Annotations use dd-trace keys: `inputData`, `outputData`, `metadata`, `tags`, `metrics`.
- **Important**: Evaluations must be submitted within 60 seconds of the trace completing. Scores submitted after trace cleanup will be dropped with a warning log.

## License

Apache-2.0
