---
'@mastra/core': patch
---

Allow `submit_plan` suspensions to carry an inline markdown plan body, with or without a host-owned file path, so generic hosts can render plan content without pretending a local plan file exists. Approved or rejected plan resumptions can also carry an optional user comment.
