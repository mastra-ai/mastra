---
'@mastra/core': patch
---

Fixed durable agents executing remembered tools whose schemas are absent from the current model step. Rejected calls return a recoverable tool error, allowing normal discovery before execution.
