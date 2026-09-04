---
'@mastra/memory': patch
---

Fixed observational memory buffering so transient database connection timeouts are retried instead of failing the buffer operation.
