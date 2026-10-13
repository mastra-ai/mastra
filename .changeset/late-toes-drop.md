---
'@mastra/memory': patch
---

Fixed observational memory reflection resetting the just-persisted observation cursor when storage returns detached records, which could cause already-observed messages to be observed again. Fixes #26483
