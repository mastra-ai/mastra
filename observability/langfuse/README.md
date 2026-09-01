# @mastra/langfuse

Langfuse observability provider for Mastra - uses official Langfuse v5 SDK. Use `@mastra/langfuse` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/langfuse
```

## Usage

Set `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` before creating the exporter.

```typescript
import { LangfuseExporter } from '@mastra/langfuse';

const exporter = new LangfuseExporter();
```

## Documentation

- [@mastra/langfuse documentation](https://mastra.ai/integrations/observability/langfuse)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/observability/langfuse/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
