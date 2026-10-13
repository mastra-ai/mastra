---
'@mastra/ai-sdk': patch
---

Fixed v6 chat requests with several tool approvals stopping early. If another request is already resuming one approval, the remaining approvals now still run.
