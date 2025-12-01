---
'@mastra/core': patch
---

Fix TypeScript error when using Zod schemas in `defaultOptions.structuredOutput`

Previously, defining `structuredOutput.schema` in `defaultOptions` would cause a TypeScript error because the type only accepted `undefined`. Now any valid `OutputSchema` is correctly accepted.
