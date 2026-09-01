# @mastra/arthur

Arthur AI observability provider for Mastra - exports traces using OpenInference semantic conventions. Use `@mastra/arthur` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/arthur
```

## Usage

Set `ARTHUR_API_KEY` and `ARTHUR_BASE_URL` before creating the exporter.

```typescript
import { ArthurExporter } from '@mastra/arthur';

const exporter = new ArthurExporter();
```

## Documentation

- [@mastra/arthur documentation](https://mastra.ai/integrations/observability/arthur)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/observability/arthur/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
