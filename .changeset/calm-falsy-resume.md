---
'@mastra/core': patch
---

Fixed resuming a suspended workflow step with `false`, `0`, `null`, or `""` as resume data. Explicit falsy values are now treated as real resume data instead of being dropped as missing.
