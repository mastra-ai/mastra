# ⚠️ DEPRECATED - @mastra/vector-pinecone

**This package is deprecated. Please use `@mastra/pinecone` instead.**

## Migration Guide

1. Remove this package from your dependencies:

   ```bash
   pnpm remove @mastra/vector-pinecone
   ```

2. Install the new package:

   ```bash
   pnpm add @mastra/pinecone
   ```

3. Update your imports:

   ```typescript
   // Old import
   import { PineconeVector } from "@mastra/vector-pinecone";

   // New import
   import { PineconeVector } from "@mastra/pinecone";
   ```

The new package provides the same functionality with an improved structure and additional features.
