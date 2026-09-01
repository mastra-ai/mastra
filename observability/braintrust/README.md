# @mastra/braintrust

Braintrust observability provider for Mastra - includes tracing and future observability features. Use `@mastra/braintrust` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/braintrust
```

## Usage

```typescript
import { currentSpan, initLogger } from 'braintrust';
import { BraintrustExporter } from '@mastra/braintrust';

const logger = initLogger({
  projectName: 'my-project',
  apiKey: process.env.BRAINTRUST_API_KEY,
});

const exporter = new BraintrustExporter({
  braintrustLogger: logger,
  currentSpan,
});
```

## Documentation

- [@mastra/braintrust documentation](https://mastra.ai/integrations/observability/braintrust)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/observability/braintrust/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
