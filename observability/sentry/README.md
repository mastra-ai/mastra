# @mastra/sentry

Export Mastra traces to Sentry AI monitoring with OpenTelemetry semantic conventions, zero-config setup, and optional SDK or exporter settings.

## Installation

```bash
npm install @mastra/sentry
```

## Usage

```typescript
import { Mastra } from '@mastra/core/mastra';
import { Observability } from '@mastra/observability';
import { SentryExporter } from '@mastra/sentry';

export const mastra = new Mastra({
  observability: new Observability({
    configs: {
      sentry: {
        serviceName: 'my-service',
        exporters: [new SentryExporter()],
      },
    },
  }),
});
```

## Documentation

- [Sentry](https://mastra.ai/integrations/observability/sentry)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/observability/sentry/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
