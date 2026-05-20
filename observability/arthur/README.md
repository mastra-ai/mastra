# @mastra/arthur - OpenTelemetry + OpenInference Tracing Exporter

Export Mastra traces to [Arthur AI](https://arthur.ai) using [OpenInference Semantic Conventions](https://github.com/Arize-ai/openinference/tree/main/spec).

## Installation

```bash
npm install @mastra/arthur
```

## Configuration

Add `ArthurExporter` to your Mastra configuration to export traces to Arthur. The exporter automatically reads credentials from environment variables, enabling zero-config setup.

### Zero-Config

Set environment variables:

```bash
ARTHUR_API_KEY=your-api-key
ARTHUR_BASE_URL=https://app.arthur.ai
ARTHUR_TASK_ID=your-task-id  # optional, associates traces with a specific Arthur task
```

```typescript
import { ArthurExporter } from '@mastra/arthur';
import { Mastra } from '@mastra/core/mastra';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      arthur: {
        serviceName: 'my-service',
        exporters: [new ArthurExporter()],
      },
    },
  },
});
```

### Explicit Configuration

```typescript
import { ArthurExporter } from '@mastra/arthur';
import { Mastra } from '@mastra/core/mastra';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      arthur: {
        serviceName: 'my-service',
        exporters: [
          new ArthurExporter({
            apiKey: 'your-api-key',
            endpoint: 'https://app.arthur.ai',
          }),
        ],
      },
    },
  },
});
```

## Optional Configuration

```typescript
new ArthurExporter({
  // Required at runtime (or set ARTHUR_API_KEY env var)
  apiKey: 'your-api-key',
  // Required at runtime (or set ARTHUR_BASE_URL env var)
  endpoint: 'https://app.arthur.ai',
  // Optional headers added to each OTLP request
  headers: {
    'x-custom-header': 'value',
  },
  // Optional log level for debugging
  logLevel: 'debug',
  // Optional batch size for the underlying BatchSpanProcessor
  batchSize: 512,
  // Optional timeout for span export
  timeout: 30000,
  // Optional resource attributes added to each span
  resourceAttributes: {
    'custom.attribute': 'value',
  },
});
```

### Custom metadata

Custom span attributes are serialized into the OpenInference `metadata` payload. Add them through `tracingOptions.metadata`:

```typescript
await agent.generate(input, {
  tracingOptions: {
    metadata: {
      companyId: 'acme-co',
    },
  },
});
```

## OpenInference Semantic Conventions

This exporter follows the [OpenInference Semantic Conventions](https://github.com/Arize-ai/openinference/tree/main/spec) for generative AI applications. All agent runs, tool calls, and LLM generations are automatically tagged with the correct span kinds and attributes.

## License

Apache 2.0
