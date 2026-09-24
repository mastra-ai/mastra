---
'@mastra/memory': patch
---

Observational memory no longer holds a turn for about 5 minutes retrying an attachment that can't be downloaded. The observer shows it as a placeholder, and skips attachments the agent has already recorded as unavailable. See #23705.
