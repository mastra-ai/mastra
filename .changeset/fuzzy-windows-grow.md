---
'@mastra/core': patch
'@mastra/server': patch
---

Fixed explicit MessageHistory persistence without a Memory instance to respect write permissions and read-only settings, save messages to the resolved thread, and roll back blocked responses. Prevent client-supplied request context from overriding framework-managed memory identity.
