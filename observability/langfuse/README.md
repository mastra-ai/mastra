# @mastra/langfuse

Export Mastra traces to Langfuse for open-source LLM observability, configure credentials and endpoints, and inspect prompts, tools, and generations.

## Installation

```bash
npm install @mastra/langfuse
```

## Usage

Set `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` before creating the exporter.

```typescript
import { Mastra } from '@mastra/core/mastra';
import { Observability } from '@mastra/observability';
import { LangfuseExporter } from '@mastra/langfuse';

export const mastra = new Mastra({
  observability: new Observability({
    configs: {
      langfuse: {
        serviceName: 'my-service',
        exporters: [new LangfuseExporter()],
      },
    },
  }),
});
```

## Documentation

- [Langfuse](https://mastra.ai/integrations/observability/langfuse)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/observability/langfuse/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
