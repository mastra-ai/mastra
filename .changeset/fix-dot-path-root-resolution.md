---
'@mastra/gcs': patch
'@mastra/s3': patch
---

Fix `toKey()` to resolve `"."` and `"./"` as the root path

Both `GCSFilesystem` and `S3Filesystem` produced invalid object keys when called with `path: "."` (e.g. `prefix/.` instead of `prefix/`). Since the built-in `mastra_workspace_list_files` tool and Mastra Studio both default to `path: "."`, workspace directory listings returned empty results when backed by GCS or S3.

`toKey()` now normalises `"."` and `"./"` to empty string before prepending the prefix, matching the existing behaviour of `"/"`. Dotfiles like `.env` or `.gitignore` are unaffected.
