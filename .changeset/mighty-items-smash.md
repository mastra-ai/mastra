---
'@mastra/core': patch
---

Fixed the writer object being undefined in processOutputStream, allowing output processors to emit custom events to the stream during chunk processing. This enables use cases like streaming moderation results back to the client.
