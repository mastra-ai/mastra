---
'@mastra/blaxel': patch
'@mastra/e2b': patch
---

Fixed S3 mount race condition when mounting multiple S3 filesystems concurrently. Each mount now uses a unique per-path credentials file, preventing credentials from being overwritten mid-mount. Also added validation that rejects partial credential pairs with a clear error message.
