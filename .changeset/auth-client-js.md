---
'@mastra/client-js': patch
---

Added `getFullUrl` helper method for constructing auth redirect URLs and exported the `AuthCapabilities` type. HTTP retries now skip 4xx client errors to avoid retrying authentication failures.
