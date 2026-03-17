---
'@mastra/memory': patch
---

Fixed observational memory triggering observation while provider-executed tool calls are still pending, which could split messages and cause errors on follow-up turns.
