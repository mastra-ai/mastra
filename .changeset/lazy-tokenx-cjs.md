---
'@mastra/core': patch
---

Fixed CommonJS and Jest loading of token counting so the ESM-only tokenx package is imported only when a count runs. Fixes #22609.
