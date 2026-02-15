---
'@mastra/deployer': patch
---

Fixes `mastra build` on Windows that incorrectly added spurious npm dependencies from monorepo directory names.

Workspace paths are normalized to use forward slashes so import-path comparisons match Rollup on Windows.

Fixes https://github.com/mastra-ai/mastra/issues/13022
