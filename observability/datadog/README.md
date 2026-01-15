# @mastra/datadog

Datadog LLM Observability exporter for Mastra. Exports observability data to [Datadog's LLM Observability](https://docs.datadoghq.com/llm_observability/) product.

## Installation

```bash
pnpm add @mastra/datadog
```

## Requirements

- **Node.js >=22.13.0** (Node.js 22.x recommended for best native module compatibility)
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

| Mastra SpanType    | Datadog Kind |
| ------------------ | ------------ |
| `AGENT_RUN`        | `agent`      |
| `MODEL_GENERATION` | `workflow`   |
| `MODEL_STEP`       | `llm`        |
| `TOOL_CALL`        | `tool`       |
| `MCP_TOOL_CALL`    | `tool`       |
| `WORKFLOW_RUN`     | `workflow`   |
| All other types    | `task`       |

All unmapped span types (including `MODEL_CHUNK`, `GENERIC`, etc., and future span types) automatically default to `task`.

## Features

- **Completion-only pattern**: Spans are emitted at completion for efficient tracing
- **Message formatting**: LLM inputs/outputs formatted as message arrays
- **Metadata as tags**: Span metadata is flattened into searchable Datadog tags
- **Error tracking**: Error spans include error tags with message, ID, and category
- **Parent/child hierarchy**: Spans are emitted parent-first to preserve trace trees in Datadog

## Troubleshooting

### Native module ABI errors

If you see errors like `No native build was found for runtime=node abi=137`:

1. **Use Node.js 22.x** - Native modules have best compatibility with Node.js 22.x
2. **Ignore the warnings** - Native modules are optional; core tracing still works without them

### Bundler configuration

When using bundlers, mark `dd-trace` and native modules as external:

```typescript
// mastra.config.ts
export default {
  bundler: {
    externals: [
      "dd-trace",
      "@datadog/native-metrics",
      "@datadog/native-appsec",
      "@datadog/native-iast-taint-tracking",
      "@datadog/pprof",
    ],
  },
};
```

## License

Apache-2.0
