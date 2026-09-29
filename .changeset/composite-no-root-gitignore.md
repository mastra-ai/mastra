---
'@mastra/core': patch
---

Fixed workspace `grep` and `list_files` failing with "No mount for path: .gitignore" when a `CompositeFilesystem` has no root (`/`) mount. Reads of unmounted paths now report a not-found (`ENOENT`) error, so a missing root `.gitignore` is treated as absent.
