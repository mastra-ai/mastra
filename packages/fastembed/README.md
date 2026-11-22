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

### Input length

FastEmbed models embed at most 512 tokens per input (roughly 2,000 to 2,500 characters of English text). Longer inputs are truncated: text past the limit doesn't affect the embedding. The AI SDK v3 models return a warning when this happens. Chunk long documents to fit the window, for example with `maxSize: 1500` in `MDocument.chunk()`.

### CPU usage

Under a CPU limit, such as a container's CPU quota, FastEmbed runs each model with one thread per CPU the process may use. Without a limit, ONNX Runtime picks the count itself (one thread per physical core). Each loaded model has its own threads, so models loaded side by side add up. To leave CPU for the rest of the process, or when the limit isn't visible to the process (for example a Kubernetes CPU request without a limit), set the thread count per model with the `MASTRA_FASTEMBED_THREADS` environment variable:

```bash
MASTRA_FASTEMBED_THREADS=2
```

The variable applies wherever FastEmbed loads a model, including `fastembed`, `fastembed.small`, and the other exported models. If you build a model yourself with `FlagEmbedding.init()` or `SparseTextEmbedding.init()`, the `threads` option sets the count for that model and takes precedence over the variable.

## Documentation

- [Use FastEmbed for local semantic recall](https://mastra.ai/docs/memory/semantic-recall#using-fastembed-local)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/fastembed/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
