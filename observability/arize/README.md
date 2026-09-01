# @mastra/arize

Arize observability provider for Mastra - includes tracing and future observability features. Use `@mastra/arize` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/arize
```

## Usage

Set `PHOENIX_COLLECTOR_ENDPOINT` and, for authenticated instances, `PHOENIX_API_KEY`.

```typescript
import { ArizeExporter } from '@mastra/arize';

const exporter = new ArizeExporter();
```

## Documentation

- [@mastra/arize documentation](https://mastra.ai/integrations/observability/arize)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/observability/arize/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
