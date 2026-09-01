# @mastra/observability

Core observability package for Mastra - includes tracing and scoring features. Use `@mastra/observability` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/observability
```

## Usage

Configure the prerequisites described in the documentation.

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

- [@mastra/observability documentation](https://mastra.ai/docs/observability/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/observability/mastra/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
