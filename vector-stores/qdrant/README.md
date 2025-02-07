# ⚠️ DEPRECATED - @mastra/vector-qdrant

**This package is deprecated. Please use `@mastra/qdrant` instead.**

## Migration Guide

1. Remove this package from your dependencies:
   ```bash
   pnpm remove @mastra/vector-qdrant
   ```

2. Install the new package:
   ```bash
   pnpm add @mastra/qdrant
   ```

3. Update your imports:
   ```typescript
   // Old import
   import { QdrantVector } from "@mastra/vector-qdrant";

   // New import
   import { QdrantVector } from "@mastra/qdrant";
   ```

The new package provides the same functionality with an improved structure and additional features.
