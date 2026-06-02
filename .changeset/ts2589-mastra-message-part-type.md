---
'@mastra/core': patch
---

Fixed a TypeScript TS2589 "type instantiation is excessively deep" error when using Mastra alongside deeply-generic libraries such as @hono/zod-openapi.
