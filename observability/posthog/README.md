# @mastra/posthog

Export Mastra traces to PostHog AI observability as structured events, with project credentials, host configuration, and serverless flushing.

## Installation

```bash
npm install @mastra/posthog
```

## Usage

Set `POSTHOG_API_KEY` before creating the exporter.

```typescript
import { Mastra } from '@mastra/core/mastra';
import { Observability } from '@mastra/observability';
import { PosthogExporter } from '@mastra/posthog';

export const mastra = new Mastra({
  observability: new Observability({
    configs: {
      posthog: {
        serviceName: 'my-service',
        exporters: [new PosthogExporter()],
      },
    },
  }),
});
```

## Documentation

- [PostHog](https://mastra.ai/integrations/observability/posthog)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/observability/posthog/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
