# @mastra/fastembed

This package provides a FastEmbed embedding model integration for use with Mastra Memory.

**Note:** This functionality was previously included directly within `@mastra/core`. It has been moved to this separate package because `fastembed-js` relies on large native dependencies (like `onnxruntime-node`). Separating it keeps `@mastra/core` lightweight for users who may not need FastEmbed.

## Installation

```bash
pnpm add @mastra/fastembed
```

## Usage

```typescript
import { Memory } from '@mastra/memory';
import { fastembed } from '@mastra/fastembed';

const memory = new Memory({
  // ... other memory options
  embedder: fastembed,
});

// Now you can use this memory instance with an Agent
// const agent = new Agent({ memory, ... });
```

This package wraps the `fastembed-js` library to provide an embedding model compatible with the AI SDK and Mastra.
