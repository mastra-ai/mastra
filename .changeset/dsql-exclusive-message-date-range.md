---
'@mastra/dsql': patch
---

Fix `listMessages` date-range filtering to honor exclusive start and end boundaries. This prevents boundary messages from appearing twice when paginating observational memory.
