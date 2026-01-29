---
'@mastra/core': patch
---

Fixed TypeScript error when calling bail() in workflow steps. bail() now accepts any value, so workflows can exit early with a custom result. Fixes #12424.
