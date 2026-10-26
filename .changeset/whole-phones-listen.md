---
'@mastra/core': patch
---

Fixed durable agent HTTP observations closing during silent execution by checking producer liveness before releasing the subscription.
