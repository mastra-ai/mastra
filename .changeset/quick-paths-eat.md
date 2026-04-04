---
'@mastra/memory': patch
'@mastra/core': patch
---

Fixed observational memory buffering so sealed assistant chunks stay split instead of being merged back into one persisted message during long tool runs.
