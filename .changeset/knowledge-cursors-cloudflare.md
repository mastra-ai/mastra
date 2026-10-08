---
'@mastra/cloudflare': patch
---

Removed the deprecated Knowledge curation cursor table from this store's table list, matching `@mastra/core`, which no longer creates it. Nothing changes for your app: this store never read or wrote Knowledge cursors. No peer dependency ranges change.
