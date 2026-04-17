---
'@mastra/core': minor
'@mastra/playground-ui': patch
---

Added a new `@mastra/core/client` subpath export that provides browser-safe types, enums, and utilities. This fixes the Vite error `Module 'stream/web' has been externalized for browser compatibility` caused by barrel file contamination when importing from `@mastra/core/storage` or `@mastra/core/observability` in frontend code.

**Usage:**

```ts
// Before (causes Vite errors in browser)
import { TraceStatus } from '@mastra/core/storage';
import { EntityType } from '@mastra/core/observability';
import { coreFeatures } from '@mastra/core/features';

// After (browser-safe)
import { TraceStatus, EntityType, coreFeatures } from '@mastra/core/client';
```
