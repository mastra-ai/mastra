---
'@mastra/ai-sdk': patch
---

Fixed toAISdkStream so DurableAgent streams no longer crash when a step-start chunk has no payload.
