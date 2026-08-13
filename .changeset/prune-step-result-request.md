---
'@mastra/core': patch
---

Reduced persisted agent-loop snapshot size by no longer storing duplicated provider request data (measured at 24% of all persisted snapshot bytes in production). Resume behavior and step routing data are unchanged.
