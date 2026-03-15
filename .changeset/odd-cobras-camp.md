---
'@mastra/schema-compat': patch
---

Fixed TypeScript inference for the `createTool` `execute` callback's `inputData` parameter. When using a typed `inputSchema`, `inputData` is now correctly inferred instead of falling back to `unknown`. See [#14252](https://github.com/mastra-ai/mastra/issues/14252)
