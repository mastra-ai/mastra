# @mastra/braintrust

Braintrust AI Observability exporter for Mastra applications.

## Installation

```bash
npm install @mastra/braintrust
```

## Usage

### Zero-Config Setup

The exporter automatically reads credentials from environment variables:

```bash
# Required
BRAINTRUST_API_KEY=sk-...

# Optional
BRAINTRUST_ENDPOINT=https://api.braintrust.dev
```

```typescript
import { BraintrustExporter } from '@mastra/braintrust';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      braintrust: {
        serviceName: 'my-service',
        exporters: [new BraintrustExporter()],
      },
    },
  },
});
```

### Explicit Configuration

You can also pass credentials directly:

```typescript
import { BraintrustExporter } from '@mastra/braintrust';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      braintrust: {
        serviceName: 'my-service',
        exporters: [
          new BraintrustExporter({
            apiKey: 'sk-...',
            projectName: 'mastra-tracing', // Optional, defaults to 'mastra-tracing'
            endpoint: 'https://api.braintrust.dev', // Optional
          }),
        ],
      },
    },
  },
});
```

### Configuration Options

| Option             | Type                 | Description                                                    |
| ------------------ | -------------------- | -------------------------------------------------------------- |
| `apiKey`           | `string`             | Braintrust API key. Defaults to `BRAINTRUST_API_KEY` env var   |
| `endpoint`         | `string`             | Custom endpoint URL. Defaults to `BRAINTRUST_ENDPOINT` env var |
| `projectName`      | `string`             | Project name. Defaults to `'mastra-tracing'`                   |
| `braintrustLogger` | `Logger<true>`       | Optional Braintrust logger instance for context integration    |
| `tuningParameters` | `Record<string,any>` | Support tuning parameters                                      |

## Features

### Tracing

- **Automatic span mapping**: Root spans become Braintrust traces
- **Type-specific metadata**: Extracts relevant metadata for each span type (agents, tools, workflows)
- **Error tracking**: Automatic error status and message tracking
- **Hierarchical traces**: Maintains parent-child relationships
- **Event span support**: Zero-duration spans for event-type traces
- **Context integration**: Attach to existing Braintrust spans from `logger.traced()` or `Eval()`
