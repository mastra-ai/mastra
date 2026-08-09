---
'@mastra/core': patch
---

Fixed a race condition in the workspace LSP manager where three or more concurrent diagnostics requests for the same file could acquire the per-file lock at the same time. Requests for a file are now strictly serialized in FIFO order, preventing interleaved open/change/close notifications that produced wrong or missing diagnostics.
