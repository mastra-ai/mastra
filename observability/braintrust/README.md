# @mastra/braintrust

Export Mastra traces to Braintrust for LLM evaluation and monitoring with zero-config environment variables or explicit project configuration.

## Installation

```bash
npm install @mastra/braintrust
```

## Usage

```typescript
import { Mastra } from '@mastra/core/mastra';
import { Observability } from '@mastra/observability';
import { BraintrustExporter } from '@mastra/braintrust';

export const mastra = new Mastra({
  observability: new Observability({
    configs: {
      braintrust: {
        serviceName: 'my-service',
        exporters: [new BraintrustExporter()],
      },
    },
  }),
});
```

## Documentation

- [Braintrust](https://mastra.ai/integrations/observability/braintrust)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/observability/braintrust/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
