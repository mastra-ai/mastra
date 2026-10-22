---
'@mastra/core': patch
---

Fixed LocalFilesystem writes through symlinked parent directories leaving the workspace. Fixes #27916.
