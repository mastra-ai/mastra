---
'@mastra/deployer': patch
---

Fixed `mastra dev` startup hangs in large monorepos with repeated workspace dependencies.

Improved dependency analysis so shared workspace packages are only analyzed once during startup. This reduces repeated Rollup work and keeps development startup responsive in large repos. Fixes #12843.
