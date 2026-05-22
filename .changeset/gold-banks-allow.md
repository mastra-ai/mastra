---
'@mastra/core': patch
---

Fixed split-brain broker election race in UnixSocketPubSub. When a broker process dies and multiple clients recover concurrently, an exclusive lock file now serializes the election so exactly one process becomes the new broker.
