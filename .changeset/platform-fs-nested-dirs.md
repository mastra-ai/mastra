---
'@mastra/platform-workspace': patch
---

Fixed nested folders in `PlatformFilesystem` workspaces failing to open in Studio. Folders that exist only because a file was written under them (for example `writeFile('/foo/bar.md')`) now report as directories from `stat` and `exists`, so Studio can list their contents. `mkdir` now creates a trailing-slash folder marker, which avoids an `Invalid object key` error when listing.
