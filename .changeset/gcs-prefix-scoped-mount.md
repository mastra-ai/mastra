---
"@mastra/gcs": patch
"@mastra/e2b": patch
---

Add prefix-scoped GCS sandbox mounts (parity with S3 and Azure)

`GCSFilesystem.getMountConfig()` now includes its `prefix` (trailing slash
stripped), and the E2B `mountGCS` adds the corresponding `gcsfuse --only-dir`
flag when a prefix is set. This scopes the FUSE mount to the prefixed
subdirectory so sandbox paths map directly to prefixed GCS keys — matching the
existing S3 (`bucket:/prefix`) and Azure (`--subdirectory`) mounts. Previously a
prefixed `GCSFilesystem` dropped the prefix at both layers and mounted the entire
bucket inside the sandbox.

The prefix is validated with the existing `validatePrefix` (path-traversal guard)
and shell-escaped with `shellQuote`.
