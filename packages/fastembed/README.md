# @mastra/fastembed

Local embedding model integration for Mastra, powered by ONNX Runtime.

This package is a maintained fork of [fastembed-js](https://github.com/Anush008/fastembed-js) (now archived). The upstream source has been vendored directly into this package so that `@mastra/fastembed` no longer depends on the unmaintained `fastembed` npm package.

## Installation

```bash
npm install @mastra/fastembed
```

## Usage

### Default (AI SDK v3)

```typescript
import { Memory } from '@mastra/memory';
import { fastembed } from '@mastra/fastembed';

const memory = new Memory({
  // ... other memory options
  embedder: fastembed,
});
```

## Documentation

- [Use FastEmbed for local semantic recall](https://mastra.ai/docs/memory/semantic-recall#using-fastembed-local)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/fastembed/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
