# @mastra/otel-exporter

Export Mastra traces and logs to any OpenTelemetry-compatible observability platform.

> **⚠️ Important:** This package requires you to install an additional exporter package based on your provider. Each provider section below includes the specific installation command.

## Installation

```bash
npm install @mastra/otel-exporter
```

## Usage

Set the standard `OTEL_EXPORTER_OTLP_*` environment variables for your collector.

```typescript
import { Mastra } from '@mastra/core/mastra';
import { Observability } from '@mastra/observability';
import { OtelExporter } from '@mastra/otel-exporter';

export const mastra = new Mastra({
  observability: new Observability({
    configs: {
      otel: {
        serviceName: 'my-service',
        exporters: [new OtelExporter({ provider: { dash0: {} } })],
      },
    },
  }),
});
```

## Documentation

- [@mastra/otel-exporter documentation](https://mastra.ai/integrations/observability/opentelemetry)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/observability/otel-exporter/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
