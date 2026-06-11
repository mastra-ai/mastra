---
'@mastra/schema-compat': patch
'@mastra/core': patch
---

Fixed `createTool` `execute` callback to accept raw return values when using Zod `.transform()` in output schemas, eliminating type errors that previously required `as any` workarounds.
