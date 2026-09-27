---
'@mastra/platform-workspace': patch
---

Fixed nested folders in `PlatformFilesystem` workspaces so they open in Studio. Folders created by writing a file under them are now reported by `stat` and `exists`, and can be listed with `readdir`.
