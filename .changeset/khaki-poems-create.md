---
'@mastra/core': patch
---

Fixed goal continuation not streaming to TUI after judge evaluation. The subscription generator now breaks out of the inner read loop after terminal stream chunks and drains remaining data in the background, preventing post-processing from blocking subsequent runs.
