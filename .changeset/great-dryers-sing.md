---
'@mastra/core': patch
---

Fixed evented workflows failing with "condition is not a function" when a dountil or dowhile loop body is a nested workflow and events go through a serializing pubsub such as Redis Streams. The loop condition is now read from the live workflow registry instead of the serialized event payload, which cannot carry functions. Fixes [#23111](https://github.com/mastra-ai/mastra/issues/23111).
