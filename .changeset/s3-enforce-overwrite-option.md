---
'@mastra/s3': patch
---

Added `overwrite: false` support to `writeFile` and `copyFile`. Previously, the `overwrite` option was ignored, allowing files to be silently overwritten. Now throws `FileExistsError` when `overwrite` is set to `false` and the destination file already exists.
