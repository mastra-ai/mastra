---
'@mastra/core': patch
---

Fixed `LocalFilesystem` so writes through symlinked parent directories cannot create files or directories outside the workspace or allowed paths. Writes outside those roots now throw `PermissionError`. Symlinked writes within allowed roots still succeed. Fixes #27916.
