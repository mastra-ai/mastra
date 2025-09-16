# @mastra/langfuse

Langfuse AI Observability exporter for Mastra applications.

## Installation

```bash
npm install @mastra/langfuse
```

## Usage

```typescript
import { LangfuseExporter } from '@mastra/langfuse';

// Use with Mastra
const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      langfuse: {
        serviceName: 'service',
        exporters: [
          new LangfuseExporter({
            publicKey: process.env.LANGFUSE_PUBLIC_KEY,
            secretKey: process.env.LANGFUSE_SECRET_KEY,
            baseUrl: process.env.LANGFUSE_BASE_URL, // Optional - defaults to Langfuse cloud
            realtime: true,
          }),
        ],
      },
    },
  },
});
```

## Features

### AI Tracing

- **Automatic span mapping**: Root spans become Langfuse traces
- **LLM generation support**: `LLM_GENERATION` spans become Langfuse generations with token usage
- **Type-specific metadata**: Extracts relevant metadata for each span type (agents, tools, workflows)
- **Error tracking**: Automatic error status and message tracking
- **Hierarchical traces**: Maintains parent-child relationships
