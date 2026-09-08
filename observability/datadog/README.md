# @mastra/datadog

Datadog LLM Observability exporter for Mastra. Exports observability data to [Datadog's LLM Observability](https://docs.datadoghq.com/llm_observability/) product.

## Installation

```bash
npm install @mastra/datadog
```

## Usage

### Basic Setup

```typescript
import { Mastra } from '@mastra/core/mastra';
import { Observability } from '@mastra/observability';
import { DatadogExporter } from '@mastra/datadog';

export const mastra = new Mastra({
  observability: new Observability({
    configs: {
      datadog: {
        serviceName: 'my-service',
        exporters: [new DatadogExporter()],
      },
    },
  }),
});
```

## Documentation

- [@mastra/datadog documentation](https://mastra.ai/integrations/observability/datadog)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/observability/datadog/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
