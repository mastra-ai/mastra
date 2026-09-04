---
'@mastra/inngest': patch
---

Fixed Inngest workflow steps receiving `retryCount: 0` on every retry; steps now receive the current attempt number.
