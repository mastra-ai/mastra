---
'@mastra/core': patch
---

Fixed Knowledge structure reconciliation failures at startup not being shown. The warning now goes to the logger configured on Mastra, including loggers set with `setLogger()` and Knowledge added with `addKnowledge()`.
