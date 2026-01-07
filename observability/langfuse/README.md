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
          }),
        ],
      },
    },
  },
});
```

### Configuration Options

| Option      | Type      | Description                                                                    |
| ----------- | --------- | ------------------------------------------------------------------------------ |
| `publicKey` | `string`  | Langfuse public key. Defaults to `LANGFUSE_PUBLIC_KEY` env var                 |
| `secretKey` | `string`  | Langfuse secret key. Defaults to `LANGFUSE_SECRET_KEY` env var                 |
| `baseUrl`   | `string`  | Langfuse host URL. Defaults to `LANGFUSE_BASE_URL` env var or Langfuse cloud   |
| `realtime`  | `boolean` | Flush after each event for immediate visibility. Defaults to `false`           |
| `options`   | `object`  | Additional options to pass to the Langfuse client                              |

## Features

### Tracing

- **Automatic span mapping**: Root spans become Langfuse traces
- **Model generation support**: `MODEL_GENERATION` spans become Langfuse generations with token usage
- **Type-specific metadata**: Extracts relevant metadata for each span type (agents, tools, workflows)
- **Error tracking**: Automatic error status and message tracking
- **Hierarchical traces**: Maintains parent-child relationships
