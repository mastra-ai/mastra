---
'@mastra/core': patch
---

Include the failing URL in the `DOWNLOAD_ASSETS_FAILED` error thrown from `downloadFromUrl`. The error's `text` now reads `Failed to download asset: <url>` and `details.url` is populated. Previously the URL was nowhere in the error chain (`text` was a fixed string, `details` was empty, and the inner cause from `fetchWithRetry` only carries the HTTP status), which made it impossible to identify which media URL failed when an agent has multiple parts or to drive downstream recovery (e.g. replacing the dead URL with a placeholder on retry).
