# @mastra/braintrust

Braintrust AI Observability exporter for Mastra applications.

## Installation

```bash
npm install @mastra/braintrust
```

## Usage

```typescript
import { BraintrustExporter } from '@mastra/braintrust';

// Use with Mastra
const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      braintrust: {
        serviceName: 'service',
        exporters: [
          new BraintrustExporter({
            apiKey: process.env.BRAINTRUST_API_KEY,
            projectName: "mastra-tracing", // optional
            endpoint: process.env.BRAINTRUST_ENDPOINT, // optional
          }),
        ],
      },
    },
  },
});
```

## Features

### AI Tracing

- **Automatic span mapping**: Root spans become Braintrust traces
- **Type-specific metadata**: Extracts relevant metadata for each span type (agents, tools, workflows)
- **Error tracking**: Automatic error status and message tracking
- **Hierarchical traces**: Maintains parent-child relationships
- **Event span support**: Zero-duration spans for event-type traces
