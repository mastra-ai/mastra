---
'@mastra/core': patch
---

Fixed a crash that could occur when background execution is enabled for tools with Zod v3 input schemas.

Tools with Zod v3, Zod v4, and JSON Schema input definitions now work consistently with background execution.
