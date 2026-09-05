---
'@mastra/schema-compat': patch
'@mastra/core': patch
---

Fixed `createTool.execute` typing to accept the schema input shape before output validation and transformation. Code relying on the previous post-transform callback annotation may need a type adjustment after upgrading. Runtime validation and transformation remain unchanged.
