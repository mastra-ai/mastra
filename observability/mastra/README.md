# @mastra/observability

Monitor Mastra agents, workflows, tools, and model calls in Studio with metrics dashboards, hierarchical traces, and searchable correlated logs.

## Installation

```bash
npm install @mastra/observability
```

## Usage

```typescript
import { Mastra } from '@mastra/core';
import { Observability, MastraStorageExporter, MastraPlatformExporter } from '@mastra/observability';

export const mastra = new Mastra({
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'my-app',
        exporters: [
          new MastraStorageExporter(), // Persists observability events to Mastra Storage
          new MastraPlatformExporter(), // Sends observability events to Mastra Platform
        ],
      },
    },
  }),
});
```

## Documentation

- [Observability](https://mastra.ai/docs/studio/observability)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/observability/mastra/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
