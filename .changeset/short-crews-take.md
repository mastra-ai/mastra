---
'@mastra/core': patch
---

Fixes assistant message ids when using toUIMessageStream, preserves the original messageId rather than creating a new id for this message.
