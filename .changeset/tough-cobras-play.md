---
'@mastra/server': patch
---

Fixed streamed agent-controller error events losing their message: Error instances are now flattened before serialization so clients see the real failure reason instead of a generic "Error".
