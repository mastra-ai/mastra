---
'@mastra/inngest': patch
---

Fixed Inngest workflow cancellation so it only stops the run you asked to cancel. Canceling one durable agent run no longer tears down other active runs of the same workflow.
