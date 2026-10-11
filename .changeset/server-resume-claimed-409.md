---
'@mastra/server': patch
---

Fixed losing concurrent tool approvals and agent resumes returning HTTP 500. The approve, decline, and resume routes now return 409 Conflict when another request is already resuming the same run.
