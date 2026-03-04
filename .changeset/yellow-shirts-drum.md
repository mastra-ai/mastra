---
'@mastra/core': patch
---

Fixed tilde paths (`~/foo`) in contained `LocalFilesystem` silently writing to the wrong location. Previously, `~/foo` would expand and then nest under basePath (e.g. `basePath/home/user/foo`). Tilde paths are now treated as real absolute paths, and throw `PermissionError` when the expanded path is outside `basePath` and `allowedPaths`.
