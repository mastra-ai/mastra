# @mastra/fastembed

Local embedding model integration for Mastra, powered by ONNX Runtime.

This package is a maintained fork of [fastembed-js](https://github.com/Anush008/fastembed-js) (now archived). The upstream source has been vendored directly into this package so that `@mastra/fastembed` no longer depends on the unmaintained `fastembed` npm package.

## Installation

```bash
pnpm add @mastra/fastembed
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

### Available Models

```typescript
import { fastembed } from '@mastra/fastembed';

// Default export (bge-small-en-v1.5 with v3 spec)
const embedder = fastembed;

// Named exports for v3 models
const small = fastembed.small; // bge-small-en-v1.5
const base = fastembed.base; // bge-base-en-v1.5

// V2 models (for AI SDK v5 compatibility)
const smallV2 = fastembed.smallV2;
const baseV2 = fastembed.baseV2;

// Legacy v1 models (for backwards compatibility)
const smallLegacy = fastembed.smallLegacy; // bge-small-en-v1.5 (v1 spec)
const baseLegacy = fastembed.baseLegacy; // bge-base-en-v1.5 (v1 spec)
```

### Direct Usage with AI SDK

```typescript
import { embed } from 'ai';
import { fastembed } from '@mastra/fastembed';

const result = await embed({
  model: fastembed,
  value: 'Text to embed',
});

console.log(result.embedding); // number[]
```

## Supported Models

| Model                   | Dimensions | Description                 |
| ----------------------- | ---------- | --------------------------- |
| `bge-small-en-v1.5`     | 384        | Fast, default English model |
| `bge-base-en-v1.5`      | 768        | Base English model          |
| `bge-small-en`          | 384        | Fast English model          |
| `bge-base-en`           | 768        | Base English model          |
| `bge-small-zh-v1.5`     | 512        | Fast Chinese model          |
| `all-MiniLM-L6-v2`      | 384        | Sentence Transformer model  |
| `multilingual-e5-large` | 1024       | Multilingual model          |

## Attribution

The core embedding engine is forked from [fastembed-js](https://github.com/Anush008/fastembed-js) by [Anush008](https://github.com/Anush008), licensed under MIT. See [LICENSE-fastembed](./LICENSE-fastembed) for the original license.
