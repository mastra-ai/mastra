# @mastra/deepeval

[Confident AI](https://www.confident-ai.com/) observability exporter for Mastra applications. Sends your Mastra traces to Confident AI for evaluation and monitoring, built on the DeepEval SDK.

## Installation

```bash
npm install @mastra/deepeval
```

## Usage

Set `CONFIDENT_API_KEY` before creating the exporter.

```typescript
import { Mastra } from '@mastra/core/mastra';
import { Observability } from '@mastra/observability';
import { DeepEvalExporter } from '@mastra/deepeval';

export const mastra = new Mastra({
  observability: new Observability({
    configs: {
      deepeval: {
        serviceName: 'my-service',
        exporters: [new DeepEvalExporter()],
      },
    },
  }),
});
```

## Documentation

- [@mastra/deepeval documentation](https://mastra.ai/integrations/observability/confident-ai)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/observability/deepeval/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
