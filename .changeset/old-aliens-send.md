---
'@mastra/core': patch
---

Fixed per-request reply topics leaking streams on persistent pub/sub backends. The agent runtime's cross-process flows (thread owner discovery, peer discovery, and idle-signal acceptance) create a unique reply topic per request; on backends like Redis Streams, subscribing creates a real stream key that previously outlived the request forever. Reply topics are now deleted via `clearTopic` as soon as their request settles. No change for the in-memory pub/sub, where `clearTopic` is a no-op.
