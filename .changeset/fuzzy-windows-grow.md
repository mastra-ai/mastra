---
'@mastra/core': patch
---

Fixed explicit MessageHistory persistence without a Memory instance to respect write permissions and read-only settings, save messages to the resolved thread, and roll back blocked responses.
