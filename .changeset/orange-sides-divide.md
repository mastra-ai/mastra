---
'@mastra/server': patch
---

Fixed dataset create and update routes returning 500 when a schema uses an unsupported regex pattern; they now return 400 with the offending pattern.
