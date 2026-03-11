---
'@mastra/core': patch
---

Fixed `allowedPaths` resolving against the working directory instead of `basePath`, causing unexpected permission errors when `basePath` differed from `cwd`. Also fixed permission errors when accessing paths under `allowedPaths` directories that don't exist yet (e.g., during skills discovery).

- Relative `allowedPaths` now resolve from `basePath`
- Non-existent `allowedPaths` directories no longer trigger false permission errors
