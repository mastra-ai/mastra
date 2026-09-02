# @mastra/langsmith

Export Mastra traces to LangSmith for LLM monitoring and evaluation with project, API key, endpoint, and environment configuration.

## Installation

```bash
npm install @mastra/langsmith
```

## Usage

Set `LANGSMITH_API_KEY` before creating the exporter.

```typescript
import { Mastra } from '@mastra/core/mastra';
import { Observability } from '@mastra/observability';
import { LangSmithExporter } from '@mastra/langsmith';

export const mastra = new Mastra({
  observability: new Observability({
    configs: {
      langsmith: {
        serviceName: 'my-service',
        exporters: [new LangSmithExporter()],
      },
    },
  }),
});
```

## Documentation

- [LangSmith](https://mastra.ai/integrations/observability/langsmith)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/observability/langsmith/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
