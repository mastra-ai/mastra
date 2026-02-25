---
'@mastra/core': patch
'@mastra/pg': patch
---

Added metadata filtering support for `listMessages`. You can now filter messages by metadata key-value pairs using `filter: { metadata: { traceId: 'abc-123' } }`, enabling efficient lookups without paginating through all messages in a thread.
