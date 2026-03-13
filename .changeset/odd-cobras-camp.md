---
'@mastra/schema-compat': patch
---

Fixed type inference for `createTool` execute callback. After the standard schema migration, `inputData` in the `execute` function lost its type information and became `unknown`. Now TypeScript correctly infers the type from your `inputSchema`, restoring autocomplete and type checking. See [#14252](https://github.com/mastra-ai/mastra/issues/14252)
