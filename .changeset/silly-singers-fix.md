---
'@mastra/deployer': patch
'@mastra/core': patch
---

Change the function signatures of `bundle`, `lint`, and internally `getToolsInputOptions` to expand the `toolsPaths` TypeScript type from `string[]` to `(string | string[])[]`.
