---
'@mastra/core': patch
---

Fixed type error when using createTool with Agent when exactOptionalPropertyTypes is enabled in TypeScript config. The ProviderDefinedTool structural type now correctly marks inputSchema as optional and allows execute to be undefined, matching the ToolAction interface. Fixes #12281
