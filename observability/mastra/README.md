# @mastra/observability

Monitor Mastra agents, workflows, tools, and model calls with hierarchical traces, automatically extracted metrics, and structured logs correlated to the active trace.

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
        exporters: [new MastraStorageExporter(), new MastraPlatformExporter()],
      },
    },
  }),
});
```

## Documentation

`Observability` instruments agent runs, model generations, tool and MCP calls, processor execution, workflow runs, and workflow steps. Each configured observability instance has its own service name, exporters, sampling strategy, and span processors.

Exporters receive tracing events through the central observability bus. `MastraStorageExporter` persists them to the configured Mastra storage so Studio can query them, while `MastraPlatformExporter` sends them to Mastra Platform. Additional packages provide exporters for services such as Arize, Braintrust, Langfuse, LangSmith, Sentry, and OpenTelemetry-compatible backends.

A `SensitiveDataFilter` output processor is enabled by default and redacts common secrets before spans reach exporters. Set `sensitiveDataFilter: false` to disable it, or provide filter options to customize its behavior. Sampling can retain every trace, use a ratio, or apply application-specific logic.

The package automatically derives duration, status, model token, and cache token metrics from span lifecycle events. Structured logs inherit trace and span IDs, tags, and entity metadata, while metric labels pass through cardinality filtering to prevent user IDs, trace IDs, and other unbounded values from overwhelming metrics backends.

- [Observability documentation](https://mastra.ai/docs/studio/observability)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/observability/mastra/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
