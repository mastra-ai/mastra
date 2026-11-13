---
'@mastra/arize': patch
'@mastra/arthur': patch
---

Fixed the finish reason on model calls. It showed `stop` for every call, and now shows the real reason, such as `tool-calls` or `length`. Stop sequences now also appear in the invocation parameters.
