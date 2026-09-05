---
'@mastra/core': patch
---

Fix evented workflows failing with "condition is not a function" when a dountil/dowhile loop body is a nested workflow and events go through a serializing pubsub such as Redis Streams. The loop step is now resolved from the live workflow registry instead of the serialized event payload.
