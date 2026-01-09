# @mastra/langsmith

LangSmith AI Observability exporter for Mastra applications.

## Installation

```bash
npm install @mastra/langsmith
```

## Usage

### Zero-Config Setup

The exporter automatically reads credentials from environment variables:

```bash
# Required
LANGSMITH_API_KEY=lsv2_pt_...

# Optional
LANGCHAIN_PROJECT=my-project  # Project name, defaults to "default"
```

```typescript
import { LangSmithExporter } from '@mastra/langsmith';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      langsmith: {
        serviceName: 'my-service',
        exporters: [new LangSmithExporter()],
      },
    },
  },
});
```

### Explicit Configuration

You can also pass credentials directly:

```typescript
import { LangSmithExporter } from '@mastra/langsmith';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      langsmith: {
        serviceName: 'my-service',
        exporters: [
          new LangSmithExporter({
            apiKey: 'lsv2_pt_...',
            projectName: 'my-custom-project', // Optional
          }),
        ],
      },
    },
  },
});
```

### Configuration Options

| Option        | Type     | Description                                                                                |
| ------------- | -------- | ------------------------------------------------------------------------------------------ |
| `apiKey`      | `string` | LangSmith API key. Defaults to `LANGSMITH_API_KEY` env var                                 |
| `projectName` | `string` | The name of the LangSmith project to send traces to. Overrides `LANGCHAIN_PROJECT` env var |
| `apiUrl`      | `string` | Custom LangSmith API URL (for self-hosted instances)                                       |
| `client`      | `Client` | Custom LangSmith client instance                                                           |

## Features

### Tracing

- **Automatic span mapping**: Root spans become LangSmith traces
- **Type-specific metadata**: Extracts relevant metadata for each span type (agents, tools, workflows)
- **Error tracking**: Automatic error status and message tracking
- **Hierarchical traces**: Maintains parent-child relationships
- **Event span support**: Zero-duration spans for event-type traces
