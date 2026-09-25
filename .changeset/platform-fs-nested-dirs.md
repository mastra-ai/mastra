---
'@mastra/platform-workspace': patch
---

Fixed nested folders in `PlatformFilesystem` workspaces failing to open in Studio. Folders that exist only because a file was written under them (for example `writeFile('/foo/bar.md')`) now report as directories from `stat` and `exists`, and `readdir` sends list requests the workspace proxy actually routes to its list handler (bucket-root path with the prefix as a query param) instead of a bare key path the proxy treats as an object read.
