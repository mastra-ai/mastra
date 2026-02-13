---
'@mastra/deployer': patch
---

Fixed `mastra build` on Windows adding spurious npm dependencies (like `apps`) from monorepo directory names.

`path.relative()` produces backslashes on Windows but rollup uses forward slashes in import paths. The `startsWith` check against workspace paths failed due to this mismatch. Now normalizes workspace paths to forward slashes using `slash()`.

Fixes https://github.com/mastra-ai/mastra/issues/13022
