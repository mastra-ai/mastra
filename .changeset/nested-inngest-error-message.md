---
'@mastra/inngest': patch
---

Fixed nested Inngest workflow and durable agent failures losing their error message. Callers now receive the real cause (for example `step output size is greater than the limit`) instead of `{"stepId":"…","name":"Error"}`.
