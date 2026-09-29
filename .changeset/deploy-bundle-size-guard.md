---
'mastra': patch
---

`mastra deploy`, `mastra studio deploy`, and `mastra server deploy` now check the deploy bundle size before uploading. Bundles over 100 MB print a warning that lists the largest entries in `.mastra/output`. The size is sent to the platform, and when the platform rejects an oversized bundle its message is shown unchanged. Upload failures now report the bundle size.
