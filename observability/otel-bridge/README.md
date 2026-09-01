# @mastra/otel-bridge

OpenTelemetry Bridge for Mastra Observability.

Enables bidirectional integration between Mastra and OpenTelemetry infrastructure, creating real OTEL spans for Mastra operations and maintaining proper trace hierarchy.

## Installation

```bash
npm install @mastra/otel-bridge
```

## Usage

```typescript
import { OtelBridge } from '@mastra/otel-bridge';
import { Mastra } from '@mastra/core';
import { Observability } from '@mastra/observability';

const mastra = new Mastra({
  agents: { myAgent },
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'my-service',
        bridge: new OtelBridge(),
      },
    },
  }),
});
```

## Documentation

- [@mastra/otel-bridge documentation](https://mastra.ai/integrations/observability/opentelemetry)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/observability/otel-bridge/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
