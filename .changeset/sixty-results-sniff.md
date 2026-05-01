---
'@mastra/google-drive': patch
---

GoogleDriveFilesystem tweaks: mkdir defaults to recursive, appendFile uses optimistic concurrency, rmdir skips redundant child listing, JSON body requests include Content-Type header, readFile uses consistent searchParams, and concurrent token refreshes are deduplicated.
