# @mastra/otel-exporter

OpenTelemetry observability exporter for Mastra - supports OTLP traces and logs with multiple cloud providers. Use `@mastra/otel-exporter` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/otel-exporter
```

## Usage

Set the standard `OTEL_EXPORTER_OTLP_*` environment variables for your collector.

```typescript
import { OtelExporter } from '@mastra/otel-exporter';

const exporter = new OtelExporter({
  signals: { traces: true, logs: true },
});
```

## Documentation

- [@mastra/otel-exporter documentation](https://mastra.ai/integrations/observability/opentelemetry)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/observability/otel-exporter/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
