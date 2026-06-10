---
'@mastra/schema-compat': patch
'@mastra/core': patch
---

Fixed createTool execute return type to use pre-transform output schema shape when using Zod .transform(), instead of incorrectly requiring the post-transform type
