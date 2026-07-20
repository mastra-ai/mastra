# @mastra/deepeval

DeepEval (Confident AI) observability exporter for Mastra applications.

## Installation

```bash
npm install @mastra/deepeval
```

## Usage

### Zero-Config Setup

The exporter automatically reads credentials from environment variables:

```bash
# Required
CONFIDENT_API_KEY=confident_...

# Optional
CONFIDENT_TRACE_ENVIRONMENT=production  # Defaults to "development"
```

```typescript
import { Observability } from '@mastra/observability';
import { DeepEvalExporter } from '@mastra/deepeval';

const mastra = new Mastra({
  ...,
  observability: new Observability({
    configs: {
      deepeval: {
        serviceName: 'my-service',
        exporters: [new DeepEvalExporter()],
      },
    },
  }),
});
```

### Explicit Configuration

You can also pass credentials directly:

```typescript
import { Observability } from '@mastra/observability';
import { DeepEvalExporter } from '@mastra/deepeval';

const mastra = new Mastra({
  ...,
  observability: new Observability({
    configs: {
      deepeval: {
        serviceName: 'my-service',
        exporters: [
          new DeepEvalExporter({
            apiKey: 'confident_...',
            environment: 'production',
          }),
        ],
      },
    },
  }),
});
```

### Configuration Options

| Option                    | Type                     | Description                                                                    |
| ------------------------- | ------------------------ | ------------------------------------------------------------------------------ |
| `apiKey`                  | `string`                 | Confident AI API key. Defaults to the `CONFIDENT_API_KEY` env var              |
| `environment`             | `string`                 | Trace environment. Defaults to `CONFIDENT_TRACE_ENVIRONMENT` or `development`  |
| `name`                    | `string`                 | Trace name. Defaults to the Mastra `serviceName`                               |
| `tags`                    | `string[]`               | Tags applied to every trace                                                    |
| `metadata`                | `Record<string, any>`    | Metadata applied to every trace                                                |
| `metricCollection`        | `string`                 | Trace-level metric collection                                                  |
| `llmMetricCollection`     | `string`                 | Metric collection applied to LLM spans                                         |
| `agentMetricCollection`   | `string`                 | Metric collection applied to agent spans                                       |
| `toolMetricCollectionMap` | `Record<string, string>` | Metric collection applied per tool name                                        |
| `traceCaptureSink`        | `(trace) => void`        | Receives completed traces locally instead of posting (for offline evaluation) |

## Features

### Tracing

- **Native DeepEval spans**: Mastra spans become DeepEval `LLM`, `TOOL`, `RETRIEVER`, `AGENT`, and `CUSTOM` spans
- **Type-specific fields**: Extracts model, token counts, tool calls, and per-type metadata
- **Error tracking**: Automatic error status and message tracking
- **Hierarchical traces**: Maintains parent-child relationships and posts the trace once the root span ends
- **Metric collections**: Attach DeepEval metric collections at the trace and per-span-type level
