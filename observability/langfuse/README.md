# @mastra/langfuse

Langfuse AI Observability exporter for Mastra applications.

## Installation

```bash
npm install @mastra/langfuse
```

## Usage

### Zero-Config Setup

The exporter automatically reads credentials from environment variables:

```bash
# Required
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...

# Optional - defaults to Langfuse cloud
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

```typescript
import { LangfuseExporter } from '@mastra/langfuse';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      langfuse: {
        serviceName: 'my-service',
        exporters: [new LangfuseExporter()],
      },
    },
  },
});
```

### Explicit Configuration

You can also pass credentials directly:

```typescript
import { LangfuseExporter } from '@mastra/langfuse';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      langfuse: {
        serviceName: 'my-service',
        exporters: [
          new LangfuseExporter({
            publicKey: 'pk-lf-...',
            secretKey: 'sk-lf-...',
            baseUrl: 'https://cloud.langfuse.com', // Optional
            realtime: true, // Optional - flush after each event
            flushAt: 200, // Optional - spans per OTEL batch
            flushInterval: 15, // Optional - seconds between OTEL batch flushes
          }),
        ],
      },
    },
  },
});
```

### Configuration Options

| Option          | Type      | Description                                                                  |
| --------------- | --------- | ---------------------------------------------------------------------------- |
| `publicKey`     | `string`  | Langfuse public key. Defaults to `LANGFUSE_PUBLIC_KEY` env var               |
| `secretKey`     | `string`  | Langfuse secret key. Defaults to `LANGFUSE_SECRET_KEY` env var               |
| `baseUrl`       | `string`  | Langfuse host URL. Defaults to `LANGFUSE_BASE_URL` env var or Langfuse cloud |
| `realtime`      | `boolean` | Flush after each event for immediate visibility. Defaults to `false`         |
| `flushAt`       | `number`  | Maximum number of spans per OTEL export batch                                |
| `flushInterval` | `number`  | Maximum time in seconds before pending spans are exported                    |
| `environment`   | `string`  | Langfuse tracing environment tag                                             |
| `release`       | `string`  | Langfuse release tag                                                         |

### High-Volume Streaming

For self-hosted Langfuse deployments under load, increase the OTEL batch size and flush interval to reduce request pressure:

```typescript
new LangfuseExporter({
  flushAt: 500,
  flushInterval: 20,
});
```

`flushAt` and `flushInterval` map directly to the upstream `LangfuseSpanProcessor` options, so you can cross-reference Langfuse OTEL documentation when tuning them.

To suppress high-volume `MODEL_CHUNK` spans, use the observability-level `excludeSpanTypes` option. See the [span filtering reference](https://mastra.ai/reference/observability/tracing/span-filtering) for details.

## Features

### Tracing

- **Automatic span mapping**: Root spans become Langfuse traces
- **Official Langfuse OTEL export**: Uses `@langfuse/otel` and `@langfuse/client`
- **Model generation support**: `MODEL_GENERATION` spans are mapped into Langfuse generations with usage data
- **Type-specific metadata**: Preserves agent, tool, workflow, and span metadata
- **Prompt linking and TTFT**: Maps Mastra tracing metadata into Langfuse OTEL attributes
- **Error tracking**: Preserves span failures and error details in exported traces
- **Hierarchical traces**: Maintains parent-child relationships across exported spans
- **Batch tuning for self-hosted deployments**: Exposes OTEL batch size and interval controls
