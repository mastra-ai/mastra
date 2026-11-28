---
'@mastra/valkey-streams': patch
---

Fixed a teardown race where unsubscribing the last subscriber to a topic could log `NOGROUP` from a still-blocked `XREADGROUP`. Readers are now interrupted with `CLIENT UNBLOCK` and allowed to drain before their connection closes or their consumer group is dropped, and `clearTopic()` waits for in-flight teardowns on the topic before deleting the stream.
