---
'@mastra/e2b': patch
---

Fixed S3 mounts in E2B sandboxes by honoring the configured region and verifying that the FUSE mount attached successfully.

Mount failures that previously appeared successful now surface a clear error, making region, credential, and endpoint compatibility problems easier to diagnose.
