---
'@mastra/core': patch
---

Fixed startAsync so it returns only after workflow execution is durably recoverable. Fixes #24585.
