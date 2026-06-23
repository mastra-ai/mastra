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

| Option             | Type                      | Description                                                    |
| ------------------ | ------------------------- | -------------------------------------------------------------- |
| `apiKey`           | `string`                  | Braintrust API key. Defaults to `BRAINTRUST_API_KEY` env var   |
| `endpoint`         | `string`                  | Custom endpoint URL. Defaults to `BRAINTRUST_ENDPOINT` env var |
| `projectName`      | `string`                  | Project name. Defaults to `'mastra-tracing'`                   |
| `braintrustLogger` | `Logger<true>`            | Optional Braintrust logger instance for context integration    |
| `currentSpan`      | `() => Span \| undefined` | Optional resolver from the app's Braintrust package instance   |
| `tuningParameters` | `Record<string,any>`      | Support tuning parameters                                      |

## Features

### Tracing

- **Automatic span mapping**: Root spans become Braintrust traces
- **Type-specific metadata**: Extracts relevant metadata for each span type (agents, tools, workflows)
- **Error tracking**: Automatic error status and message tracking
- **Hierarchical traces**: Maintains parent-child relationships
- **Event span support**: Zero-duration spans for event-type traces
- **Context integration**: Attach to existing Braintrust spans from `logger.traced()` or `Eval()`

### Braintrust eval context

When using Braintrust `Eval()` or `logger.traced()`, pass the `currentSpan` function from the same `braintrust` import that creates the eval or traced span. This lets Mastra attach traces to the active Braintrust span even when the app and `@mastra/braintrust` resolve different installed copies of the Braintrust SDK.

```typescript
import { currentSpan, initLogger } from 'braintrust';
import { BraintrustExporter } from '@mastra/braintrust';

const logger = initLogger({
  projectName: 'my-project',
  apiKey: process.env.BRAINTRUST_API_KEY,
});

const exporter = new BraintrustExporter({
  braintrustLogger: logger,
  currentSpan,
});
```
