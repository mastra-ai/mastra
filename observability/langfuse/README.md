# @mastra/langfuse

Langfuse observability provider for Mastra applications.

## Installation

```bash
npm install @mastra/langfuse
```

## Usage

### AI Tracing

```typescript
import { DefaultAITracing } from '@mastra/core/ai-tracing';
import { LangfuseExporter } from '@mastra/langfuse';

// Configure the Langfuse exporter
const langfuseExporter = new LangfuseExporter({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  baseUrl: 'https://cloud.langfuse.com', // Optional, defaults to Langfuse cloud
});

// Create AI tracing with Langfuse export
const tracing = new DefaultAITracing({
  serviceName: 'my-mastra-app',
  sampling: { type: 'always' },
  exporters: [langfuseExporter],
});

// Use with Mastra
const mastra = new Mastra({
  aiTracing: tracing,
  // ... other config
});
```

## Configuration

### LangfuseExporterConfig

- `publicKey` (required): Your Langfuse public key
- `secretKey` (required): Your Langfuse secret key
- `baseUrl` (optional): Langfuse instance URL, defaults to cloud
- `options` (optional): Additional Langfuse client options
  - `debug`: Enable debug logging
  - `flushAt`: Number of events to batch before sending
  - `flushInterval`: Time interval for sending batched events
  - `requestTimeout`: Request timeout in milliseconds

## Features

### AI Tracing

- **Automatic span mapping**: Root spans become Langfuse traces
- **LLM generation support**: `LLM_GENERATION` spans become Langfuse generations with token usage
- **Type-specific metadata**: Extracts relevant metadata for each span type (agents, tools, workflows)
- **Error tracking**: Automatic error status and message tracking
- **Hierarchical traces**: Maintains parent-child relationships

### Future Features

- Metrics integration
- Experiment tracking
- Prompt management
- User session tracking

## License

MIT
