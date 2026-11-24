---
'@mastra/core': patch
---

Fixed explicit MessageHistory persistence to respect write permissions and read-only settings, save messages to the resolved thread, and roll back blocked responses, including when history uses a separate storage provider.
