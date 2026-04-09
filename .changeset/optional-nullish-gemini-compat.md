---
'@mastra/core': patch
---

Fixed sub-agent tool schemas to use `.optional()` instead of `.nullish()`, restoring compatibility with Google Gemini's function calling API which does not support `anyOf` unions in tool parameter schemas.
