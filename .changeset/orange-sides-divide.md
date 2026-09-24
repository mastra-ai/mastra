---
'@mastra/server': patch
'@mastra/core': patch
---

Dataset create and update routes now return 400 when a schema uses an unsupported regex pattern.
