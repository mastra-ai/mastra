# OpenTelemetry AI Tracing Exporter

Export Mastra AI traces to any OpenTelemetry-compatible observability platform.

> **⚠️ Important:** This package requires you to install an additional exporter package based on your provider. Each provider section below includes the specific installation command.

## Supported Providers

### Dash0

#### Installation

```bash
npm install @mastra/otel @opentelemetry/exporter-trace-otlp-proto
```

#### Configuration

```typescript
import { OpenTelemetryExporter } from '@mastra/otel';
import { Mastra } from '@mastra/core';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      otel: {
        serviceName: 'mastra-service',
        exporters: [
          new OpenTelemetryExporter({
            provider: {
              dash0: {
                apiKey: process.env.DASH0_API_KEY, // Required at runtime
                region: 'us', // Optional: 'us' | 'eu', defaults to 'us'
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

### SigNoz

#### Installation

```bash
npm install @mastra/otel @opentelemetry/exporter-trace-otlp-proto
```

#### Configuration

```typescript
import { OpenTelemetryExporter } from '@mastra/otel';
import { Mastra } from '@mastra/core';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      otel: {
        serviceName: 'mastra-service',
        exporters: [
          new OpenTelemetryExporter({
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
npm install @mastra/otel @opentelemetry/exporter-trace-otlp-proto
```

#### Configuration

```typescript
import { OpenTelemetryExporter } from '@mastra/otel';
import { Mastra } from '@mastra/core';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      otel: {
        serviceName: 'mastra-service',
        exporters: [
          new OpenTelemetryExporter({
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
npm install @mastra/otel @opentelemetry/exporter-trace-otlp-http
```

#### Configuration

```typescript
import { OpenTelemetryExporter } from '@mastra/otel';
import { Mastra } from '@mastra/core';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      otel: {
        serviceName: 'mastra-service',
        exporters: [
          new OpenTelemetryExporter({
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
npm install @mastra/otel @opentelemetry/exporter-trace-otlp-grpc
```

#### Configuration

```typescript
import { OpenTelemetryExporter } from '@mastra/otel';
import { Mastra } from '@mastra/core';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      otel: {
        serviceName: 'mastra-service',
        exporters: [
          new OpenTelemetryExporter({
            provider: {
              laminar: {
                apiKey: process.env.LAMINAR_API_KEY, // Required at runtime
                teamId: process.env.LAMINAR_TEAM_ID, // Required at runtime
                // endpoint: 'https://custom.lmnr.ai:8443', // Optional
              }
            },
          })
        ],
      },
    },
  },
});
```

### LangSmith

#### Installation

```bash
npm install @mastra/otel @opentelemetry/exporter-trace-otlp-http
```

#### Configuration

```typescript
import { OpenTelemetryExporter } from '@mastra/otel';
import { Mastra } from '@mastra/core';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      otel: {
        serviceName: 'mastra-service',
        exporters: [
          new OpenTelemetryExporter({
            provider: {
              langsmith: {
                apiKey: process.env.LANGSMITH_API_KEY, // Required at runtime
                projectName: 'my-project', // Optional, defaults to 'default'
                region: 'us', // Optional: 'us' | 'eu', defaults to 'us'
                // endpoint: 'https://self-hosted.com', // Optional: for self-hosted
              }
            },
          })
        ],
      },
    },
  },
});
```

### Zipkin

#### Installation

```bash
npm install @mastra/otel @opentelemetry/exporter-zipkin
```

#### Configuration

```typescript
import { OpenTelemetryExporter } from '@mastra/otel';
import { Mastra } from '@mastra/core';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      otel: {
        serviceName: 'mastra-service',
        exporters: [
          new OpenTelemetryExporter({
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
npm install @mastra/otel @opentelemetry/exporter-trace-otlp-http

# For HTTP/Protobuf: Binary format, smaller payload, recommended for production
npm install @mastra/otel @opentelemetry/exporter-trace-otlp-proto

# For gRPC: Bidirectional streaming, lowest latency, requires gRPC support
npm install @mastra/otel @opentelemetry/exporter-trace-otlp-grpc

# For Zipkin: Zipkin-specific format
npm install @mastra/otel @opentelemetry/exporter-zipkin
```

Most providers recommend HTTP/Protobuf for production use.

#### Configuration

```typescript
import { OpenTelemetryExporter } from '@mastra/otel';
import { Mastra } from '@mastra/core';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      otel: {
        serviceName: 'mastra-service',
        exporters: [
          new OpenTelemetryExporter({
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

## Additional configuration

```typescript
// Main configuration interface
interface OpenTelemetryExporterConfig {
  // Provider configuration (discriminated union)
  provider?: ProviderConfig;

  // Export configuration
  timeout?: number; // milliseconds
  batchSize?: number;

  // Debug
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}
```

## Buffering Strategy

The exporter buffers spans until a trace is complete before sending them. This ensures:

1. Complete traces are sent together
2. Parent-child relationships are preserved
3. No orphaned spans

Traces are exported 5 seconds after the root span completes, allowing time for any remaining child spans to finish.

## Attributes

The exporter adds the following attributes to spans:

### Standard Attributes

- `mastra.span.type` - Mastra span type
- `mastra.input` - Span input (serialized if object)
- `mastra.output` - Span output (serialized if object)

### LLM-Specific Attributes

- `llm.model` / `gen_ai.request.model` - Model name
- `llm.provider` / `gen_ai.system` - Provider name
- `llm.usage.prompt_tokens` / `gen_ai.usage.prompt_tokens` - Input tokens
- `llm.usage.completion_tokens` / `gen_ai.usage.completion_tokens` - Output tokens
- `llm.usage.total_tokens` - Total token count
- `llm.parameters.*` - Model parameters

### Tool Attributes

- `tool.name` - Tool name
- `tool.description` - Tool description

### Custom Attributes

- `mastra.attributes.*` - Any custom attributes from the span
- `mastra.metadata.*` - Any metadata from the span

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
