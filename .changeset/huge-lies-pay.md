---
'@mastra/core': patch
---

Fixed automatic durable agent recovery stopping after temporary storage or pubsub errors. Skipped runs are retried when the backend becomes available, without another restart or manual recovery.
