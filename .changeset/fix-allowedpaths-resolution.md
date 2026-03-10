---
'@mastra/core': patch
---

Fixed `allowedPaths` resolving against `process.cwd()` instead of `basePath`, causing permission errors when the workspace root differed from the working directory. Also fixed access to non-existent `allowedPaths` directories (e.g., during skills discovery) being incorrectly rejected.

- Relative `allowedPaths` now resolve from `basePath`
- Non-existent `allowedPaths` roots no longer cause permission errors
