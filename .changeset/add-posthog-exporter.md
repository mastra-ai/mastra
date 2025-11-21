---
'@mastra/posthog': minor
---

Add PostHog AI observability exporter

Adds a new PostHog exporter for AI tracing that sends spans to PostHog's LLM Analytics platform as structured events ($ai_generation and $ai_span). Features include:

- Event-based tracing architecture optimized for PostHog's AI analytics
- Support for privacy mode to exclude sensitive input/output data
- Serverless optimization with auto-configured batching
- Token usage normalization for AI SDK v4 and v5 formats
- Message format transformation for PostHog's strict API requirements
- 4-tier distinct ID resolution for user identification
- MODEL_CHUNK streaming event support
- Regional deployment support (US/EU/self-hosted)

```typescript
import { Mastra } from '@mastra/core';
import { Observability } from '@mastra/observability';
import { PosthogExporter } from '@mastra/posthog';

const posthogExporter = new PosthogExporter({
  apiKey: process.env.POSTHOG_API_KEY!,
});

const mastra = new Mastra({
  observability: new Observability({
    configs: {
      posthog: {
        serviceName: 'my-app',
        exporters: [posthogExporter],
      },
    },
  }),
});
```