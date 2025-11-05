# OtelExporter - OpenTelemetry Tracing Exporter

Export Mastra traces to any OpenTelemetry-compatible observability platform.

> **⚠️ Important:** This package requires you to install an additional exporter package based on your provider. Each provider section below includes the specific installation command.

## Supported Providers

### Dash0

#### Installation

```bash
# Dash0 uses gRPC protocol, requires both packages
npm install @mastra/otel-exporter @opentelemetry/exporter-trace-otlp-grpc @grpc/grpc-js
```

#### Configuration

```typescript
import { OtelExporter } from '@mastra/otel-exporter';
import { Mastra } from '@mastra/core/mastra';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      otel: {
        serviceName: 'mastra-service',
        exporters: [
          new OtelExporter({
            provider: {
              dash0: {
                apiKey: process.env.DASH0_API_KEY, // Required at runtime
                endpoint: 'ingress.us-west-2.aws.dash0.com:4317', // Required at runtime
                dataset: 'production', // Optional: dataset name
              }
            },
          })
        ],
      },
    },
  },
});
```

**Note:** Get your endpoint from your Dash0 dashboard. It should be in the format `ingress.{region}.aws.dash0.com:4317`.

### SigNoz

#### Installation

```bash
npm install @mastra/otel-exporter @opentelemetry/exporter-trace-otlp-proto
```

#### Configuration

```typescript
import { OtelExporter } from '@mastra/otel-exporter';
import { Mastra } from '@mastra/core/mastra';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      otel: {
        serviceName: 'mastra-service',
        exporters: [
          new OtelExporter({
            provider: {
              signoz: {
                apiKey: process.env.SIGNOZ_API_KEY, // Required at runtime
                region: 'us', // Optional: 'us' | 'eu' | 'in', defaults to 'us'
                // endpoint: 'https://my-signoz.example.com', // Optional: for self-hosted
              }
            },
          })
        ],
      },
    },
  },
});
```

### New Relic

#### Installation

```bash
npm install @mastra/otel-exporter @opentelemetry/exporter-trace-otlp-proto
```

#### Configuration

```typescript
import { OtelExporter } from '@mastra/otel-exporter';
import { Mastra } from '@mastra/core/mastra';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      otel: {
        serviceName: 'mastra-service',
        exporters: [
          new OtelExporter({
            provider: {
              newrelic: {
                apiKey: process.env.NEW_RELIC_LICENSE_KEY, // Required at runtime
                // endpoint: 'https://otlp.eu01.nr-data.net', // Optional: for EU region
              }
            },
          })
        ],
      },
    },
  },
});
```

### Traceloop

#### Installation

```bash
# Traceloop uses HTTP/JSON protocol
npm install @mastra/otel-exporter @opentelemetry/exporter-trace-otlp-http
```

#### Configuration

```typescript
import { OtelExporter } from '@mastra/otel-exporter';
import { Mastra } from '@mastra/core/mastra';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      otel: {
        serviceName: 'mastra-service',
        exporters: [
          new OtelExporter({
            provider: {
              traceloop: {
                apiKey: process.env.TRACELOOP_API_KEY, // Required at runtime
                destinationId: 'my-destination', // Optional
                // endpoint: 'https://custom.traceloop.com', // Optional
              }
            },
          })
        ],
      },
    },
  },
});
```

### Laminar

#### Installation

```bash
npm install @mastra/otel-exporter @opentelemetry/exporter-trace-otlp-proto
```

#### Configuration

```typescript
import { OtelExporter } from '@mastra/otel-exporter';
import { Mastra } from '@mastra/core/mastra';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      otel: {
        serviceName: 'mastra-service',
        exporters: [
          new OtelExporter({
            provider: {
              laminar: {
                apiKey: process.env.LMNR_PROJECT_API_KEY, // Required at runtime
                // teamId: process.env.LAMINAR_TEAM_ID, // Optional, for backwards compatibility
                // endpoint: 'https://api.lmnr.ai/v1/traces', // Optional
              }
            },
          })
        ],
      },
    },
  },
});
```

**Note:** Laminar now only requires the `LMNR_PROJECT_API_KEY`. The `teamId` is optional.

### Zipkin

#### Installation

```bash
npm install @mastra/otel-exporter @opentelemetry/exporter-zipkin
```

#### Configuration

```typescript
import { OtelExporter } from '@mastra/otel-exporter';
import { Mastra } from '@mastra/core/mastra';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      otel: {
        serviceName: 'mastra-service',
        exporters: [
          new OtelExporter({
            provider: {
              custom: {
                endpoint: 'http://localhost:9411/api/v2/spans',
                protocol: 'zipkin',
              }
            },
          })
        ],
      },
    },
  },
});
```

### Custom/Other Providers

#### Installation

Choose the appropriate exporter based on your collector's protocol:

```bash
# For HTTP/JSON: Human-readable, larger payload, good for debugging
npm install @mastra/otel-exporter @opentelemetry/exporter-trace-otlp-http

# For HTTP/Protobuf: Binary format, smaller payload, recommended for production
npm install @mastra/otel-exporter @opentelemetry/exporter-trace-otlp-proto

# For gRPC: Bidirectional streaming, lowest latency, requires gRPC support
npm install @mastra/otel-exporter @opentelemetry/exporter-trace-otlp-grpc @grpc/grpc-js

# For Zipkin: Zipkin-specific format
npm install @mastra/otel-exporter @opentelemetry/exporter-zipkin
```

Most providers recommend HTTP/Protobuf for production use.

#### Configuration

```typescript
import { OtelExporter } from '@mastra/otel-exporter';
import { Mastra } from '@mastra/core/mastra';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      otel: {
        serviceName: 'mastra-service',
        exporters: [
          new OtelExporter({
            provider: {
              custom: {
                endpoint: 'https://your-collector.example.com/v1/traces', // Required at runtime
                protocol: 'http/protobuf', // Optional: 'http/json' | 'http/protobuf' | 'grpc' | 'zipkin'
                headers: { // Optional
                  'x-api-key': process.env.API_KEY,
                },
              }
            }
          })
        ],
      },
    },
  },
});
```

## Why Separate Packages?

We've made exporter dependencies optional to:

- **Reduce bundle size** - Only include what you need
- **Faster installs** - Fewer dependencies to download
- **Avoid conflicts** - Some exporters have conflicting dependencies

If you forget to install the required exporter, you'll get a helpful error message telling you exactly what to install.

## Endpoint Configuration Notes

### Protocol Requirements

- **gRPC endpoints**: Automatically append `/v1/traces` to the base endpoint
- **HTTP endpoints**: Most providers expect `/v1/traces` or provider-specific paths
- **Authentication**:
  - HTTP uses `headers` with standard HTTP headers
  - gRPC uses lowercase metadata keys (e.g., `authorization` instead of `Authorization`)

### Provider-Specific Endpoints

| Provider  | Protocol      | Endpoint Format                                      | Notes              |
| --------- | ------------- | ---------------------------------------------------- | ------------------ |
| Dash0     | gRPC          | `ingress.{region}.aws.dash0.com:4317`                | Get from dashboard |
| SigNoz    | HTTP/Protobuf | `https://ingest.{region}.signoz.cloud:443/v1/traces` | Cloud hosted       |
| New Relic | HTTP/Protobuf | `https://otlp.nr-data.net:443/v1/traces`             | US region          |
| Traceloop | HTTP/JSON     | `https://api.traceloop.com/v1/traces`                | Default endpoint   |
| Laminar   | HTTP/Protobuf | `https://api.lmnr.ai/v1/traces`                      | Default endpoint   |

## Additional configuration

```typescript
// Main configuration interface
interface OtelExporterConfig {
  // Provider configuration (discriminated union)
  provider?: ProviderConfig;

  // Export configuration
  timeout?: number; // Export timeout in milliseconds (default: 30000)
  batchSize?: number; // Max spans per batch (default: 512)

  // Debug
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}
```

## Batching Strategy

The OtelExporter uses OpenTelemetry's `BatchSpanProcessor` for efficient span export:

- **Automatic batching**: Spans are queued and exported in batches
- **Default batch size**: 512 spans (configurable via `batchSize`)
- **Export interval**: Every 5 seconds or when batch is full
- **Queue size**: Up to 2048 spans queued in memory
- **Production-ready**: Optimized for high-throughput applications

This approach ensures:

- Efficient network usage (fewer HTTP/gRPC calls)
- Better performance under load
- Automatic retry with backoff
- Proper trace context propagation across all spans in a trace

## OpenTelemetry Semantic Conventions

This exporter follows the [OpenTelemetry Semantic Conventions for GenAI](https://opentelemetry.io/docs/specs/semconv/gen-ai/) to ensure compatibility with observability platforms.

### Span Naming

Spans are named following OTEL conventions:

- **LLM Operations**: `chat {model}` or `tool_selection {model}`
- **Tool Execution**: `tool.execute {tool_name}`
- **Agent Runs**: `agent.{agent_id}`
- **Workflow Runs**: `workflow.{workflow_id}`

### Attributes

The exporter maps Mastra's tracing data to OTEL-compliant attributes:

#### Core Attributes

- `gen_ai.operation.name` - Operation type (chat, tool.execute, agent.run, workflow.run)
- `gen_ai.system` - AI provider (openai, anthropic, etc.)
- `gen_ai.request.model` - Model identifier

#### LLM-Specific Attributes

- `gen_ai.usage.input_tokens` - Number of input tokens
- `gen_ai.usage.output_tokens` - Number of output tokens
- `gen_ai.usage.total_tokens` - Total token count
- `gen_ai.request.temperature` - Sampling temperature
- `gen_ai.request.max_tokens` - Maximum tokens to generate
- `gen_ai.request.top_p` - Top-p sampling parameter
- `gen_ai.request.top_k` - Top-k sampling parameter
- `gen_ai.response.finish_reasons` - Reason for completion
- `gen_ai.prompt` - Input prompt (for Model spans)
- `gen_ai.completion` - Model output (for Model spans)

#### Tool Attributes

- `gen_ai.tool.name` - Tool identifier
- `gen_ai.tool.description` - Tool description
- `gen_ai.tool.success` - Whether tool execution succeeded
- `gen_ai.tool.input` - Tool input parameters
- `gen_ai.tool.output` - Tool execution result

#### Agent & Workflow Attributes

- `agent.id` - Agent identifier
- `agent.max_steps` - Maximum agent steps
- `workflow.id` - Workflow identifier
- `workflow.status` - Workflow execution status

#### Error Attributes

- `error` - Boolean indicating error occurred
- `error.type` - Error identifier
- `error.message` - Error description
- `error.domain` - Error domain/category

## Troubleshooting

### Missing Dependency Error

If you forget to install the required exporter package, you'll get a clear error message:

```
HTTP/Protobuf exporter is not installed (required for signoz).
To use HTTP/Protobuf export, install the required package:

  npm install @opentelemetry/exporter-trace-otlp-proto
  # or
  pnpm add @opentelemetry/exporter-trace-otlp-proto
  # or
  yarn add @opentelemetry/exporter-trace-otlp-proto
```

### Common Issues

1. **Wrong exporter installed**: Make sure you installed the exporter matching your provider's protocol
2. **Multiple exporters needed**: If switching between providers, you may need multiple exporters installed
3. **Bundle size concerns**: Only install the exporters you actually use

## License

Apache 2.0
