---
'@mastra/core': patch
---

Fixed `hasMore` from `listMessages()` on the in-memory store when `include` is combined with pagination. It could report no more pages while filtered messages remained on later pages, or report more pages on the last page.
