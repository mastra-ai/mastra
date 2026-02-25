---
'@mastra/core': patch
---

Fix storage types resolving to `any`

Observability storage types such as `ListTracesResponse`, `SpanRecord`, and `ListTracesArgs` now use stable, explicit TypeScript interfaces. Type information no longer breaks when consumers use a different zod version than the one used to build `@mastra/core`.

