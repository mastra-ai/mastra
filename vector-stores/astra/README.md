# ⚠️ DEPRECATED - @mastra/vector-astra

**This package is deprecated. Please use `@mastra/astra` instead.**

## Migration Guide

1. Remove this package from your dependencies:
   ```bash
   pnpm remove @mastra/vector-astra
   ```

2. Install the new package:
   ```bash
   pnpm add @mastra/astra
   ```

3. Update your imports:
   ```typescript
   // Old import
   import { AstraVector } from "@mastra/vector-astra";

   // New import
   import { AstraVector } from "@mastra/astra";
   ```

The new package provides the same functionality with an improved structure and additional features.
