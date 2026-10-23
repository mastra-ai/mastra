---
'@mastra/memory': patch
---

Fixed observation transfers stopping at stale vector-store pages. Retry delayed updates for up to two minutes per index and report incomplete migrations so callers can retry. Fixes [#27834](https://github.com/mastra-ai/mastra/issues/27834).
