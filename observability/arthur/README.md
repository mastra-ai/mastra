# @mastra/arthur

Export Mastra traces to [Arthur AI](https://arthur.ai) using [OpenInference Semantic Conventions](https://github.com/Arize-ai/openinference/tree/main/spec).

## Installation

```bash
npm install @mastra/arthur
```

## Usage

Set `ARTHUR_API_KEY` and `ARTHUR_BASE_URL` before creating the exporter.

```typescript
import { Mastra } from '@mastra/core/mastra';
import { Observability } from '@mastra/observability';
import { ArthurExporter } from '@mastra/arthur';

export const mastra = new Mastra({
  observability: new Observability({
    configs: {
      arthur: {
        serviceName: 'my-service',
        exporters: [new ArthurExporter()],
      },
    },
  }),
});
```

## Documentation

- [@mastra/arthur documentation](https://mastra.ai/integrations/observability/arthur)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/observability/arthur/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
