---
'@mastra/core': patch
---

Fixed a crash when workflows without an inputSchema are attached to an agent via the workflows prop. Previously, this caused a TypeError during tool input validation because the schema wrapper received undefined. Workflows without an explicit inputSchema now correctly pass through input data to their steps. (#12739)
