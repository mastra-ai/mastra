---
'@mastra/core': patch
---

Fixed durable agent startup recovery getting stuck behind a stalled run. Each run's recovery wait is limited to 30 seconds without cancelling its execution, and recovery stops starting new work during shutdown.
