# @mastra/arize

Export Mastra traces to any OpenTelemetry observability platform that supports OpenInference, like [Arize AX](https://arize.com/generative-ai/), or [Phoenix](https://phoenix.arize.com/).

For more information on OpenInference, see the [OpenInference Semantic Conventions](https://github.com/Arize-ai/openinference/tree/main/spec) specification.

## Installation

```bash
npm install @mastra/arize
```

## Usage

Set `PHOENIX_COLLECTOR_ENDPOINT` and, for authenticated instances, `PHOENIX_API_KEY`.

```typescript
import { Mastra } from '@mastra/core/mastra';
import { Observability } from '@mastra/observability';
import { ArizeExporter } from '@mastra/arize';

export const mastra = new Mastra({
  observability: new Observability({
    configs: {
      arize: {
        serviceName: 'my-service',
        exporters: [new ArizeExporter()],
      },
    },
  }),
});
```

## Documentation

- [@mastra/arize documentation](https://mastra.ai/integrations/observability/arize)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/observability/arize/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
