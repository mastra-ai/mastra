# @mastra/sentry

Sentry AI observability exporter for Mastra. Use `@mastra/sentry` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/sentry
```

## Usage

Configure the prerequisites described in the documentation.

```typescript
import { Mastra } from '@mastra/core';
import { SentryExporter } from '@mastra/sentry';
import { Agent } from '@mastra/core';
import { openai } from '@ai-sdk/openai';

const mastra = new Mastra({
  observability: {
    configs: {
      sentry: {
        serviceName: 'my-ai-app',
        exporters: [
          new SentryExporter({
            dsn: process.env.SENTRY_DSN,
            environment: process.env.NODE_ENV,
            tracesSampleRate: 0.1, // Send 10% of transactions to Sentry (recommended for high-load backends)
          }),
        ],
      },
    },
  },
});

const agent = new Agent({
  name: 'customer-support',
  instructions: 'Help customers with their questions',
  model: openai('gpt-4'),
  mastra,
});

// All agent executions will be traced in Sentry
const result = await agent.generate('How do I reset my password?');
```

## Documentation

- [@mastra/sentry documentation](https://mastra.ai/docs/observability/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/observability/sentry/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
