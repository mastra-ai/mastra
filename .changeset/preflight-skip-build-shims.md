---
'@mastra/deployer': patch
---

Fix preflight `LOCAL_STORAGE_PATH` false positive triggered by dependency-optimization shims under `.mastra/.build/`. Those intermediate files re-export library code (e.g. `@mastra/core`) and contain JSDoc example strings like `file:./data.db` that were being flagged as real connection URLs.
