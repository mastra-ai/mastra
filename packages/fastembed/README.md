# @mastra/fastembed

This package provides a FastEmbed embedding model integration for use with Mastra Memory.

**Note:** This functionality was previously included directly within `@mastra/core`. It has been moved to this separate package because `fastembed-js` relies on large native dependencies (like `onnxruntime-node`). Separating it keeps `@mastra/core` lightweight for users who may not need FastEmbed.

## Installation

```bash
pnpm add @mastra/fastembed
```

## AI SDK v2 Compatibility

This package supports AI SDK v5 (specification version v2). The default exports use v2, which is compatible with `@mastra/core` and AI SDK v5.

**Breaking Change:** Previous versions used AI SDK specification v1. If you need v1 compatibility for legacy code, use the `Legacy` exports.

## Usage

### Default (AI SDK v2)

```typescript
import { Memory } from '@mastra/memory';
import { fastembed } from '@mastra/fastembed';

const memory = new Memory({
  // ... other memory options
  embedder: fastembed, // Uses v2 specification
});

// Now you can use this memory instance with an Agent
// const agent = new Agent({ memory, ... });
```

### Available Models

```typescript
import { fastembed } from '@mastra/fastembed';

// Default export (bge-small-en-v1.5 with v2 spec)
const embedder = fastembed;

// Named exports for v2 models
const small = fastembed.small; // bge-small-en-v1.5
const base = fastembed.base; // bge-base-en-v1.5

// Legacy v1 models (for backwards compatibility)
const smallLegacy = fastembed.smallLegacy; // bge-small-en-v1.5 (v1 spec)
const baseLegacy = fastembed.baseLegacy; // bge-base-en-v1.5 (v1 spec)
```

### Direct Usage with AI SDK v5

```typescript
import { embed } from 'ai';
import { fastembed } from '@mastra/fastembed';

const result = await embed({
  model: fastembed,
  value: 'Text to embed',
});

console.log(result.embedding); // number[]
```

This package wraps the `fastembed-js` library to provide an embedding model compatible with the AI SDK and Mastra.
