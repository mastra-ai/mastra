---
'@mastra/factory': patch
---

Fixed concurrent environment settings patches losing updates by merging and validating against the current project inside a database transaction.
