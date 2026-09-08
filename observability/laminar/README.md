# @mastra/laminar

Laminar observability exporter for Mastra applications.

Exports Mastra spans to Laminar via OTLP/HTTP (protobuf) and supports sending scorer results to Laminar Evaluators.

## Installation

```bash
npm install @mastra/laminar
```

## Usage

Set `LMNR_PROJECT_API_KEY` before creating the exporter.

```typescript
import { Mastra } from '@mastra/core/mastra';
import { Observability } from '@mastra/observability';
import { LaminarExporter } from '@mastra/laminar';

export const mastra = new Mastra({
  observability: new Observability({
    configs: {
      laminar: {
        serviceName: 'my-service',
        exporters: [new LaminarExporter()],
      },
    },
  }),
});
```

## Documentation

- [@mastra/laminar documentation](https://mastra.ai/integrations/observability/laminar)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/observability/laminar/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
