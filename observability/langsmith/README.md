# @mastra/langsmith

LangSmith AI Observability exporter for Mastra applications.

## Installation

```bash
npm install @mastra/langsmith
```

## Usage

```typescript
import { LangSmithExporter } from '@mastra/langsmith';

// Set process.env.LANGSMITH_TRACING = "true";

// Use with Mastra
const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      langsmith: {
        serviceName: 'service',
        exporters: [
          new LangSmithExporter({
            apiKey: process.env.LANGSMITH_API_KEY, // Defaults to process.env.LANGSMITH_API_KEY
          }),
        ],
      },
    },
  },
});
```

## Features

### Tracing

- **Automatic span mapping**: Root spans become LangSmith traces
- **Type-specific metadata**: Extracts relevant metadata for each span type (agents, tools, workflows)
- **Error tracking**: Automatic error status and message tracking
- **Hierarchical traces**: Maintains parent-child relationships
- **Event span support**: Zero-duration spans for event-type traces
