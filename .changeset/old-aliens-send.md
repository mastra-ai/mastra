---
'@mastra/core': patch
---

Fixed per-request reply topics leaking streams on persistent pub/sub backends. The agent runtime's cross-process flows (thread owner discovery, peer discovery, and idle-signal acceptance) create a unique reply topic per request; on backends like Redis Streams, subscribing creates a real stream key that previously outlived the request forever. Reply topics are now deleted via `clearTopic` as soon as their request settles, and a request whose timeout fires before its subscribe finishes no longer publishes at all. No change for the in-memory pub/sub, where `clearTopic` is a no-op.

Full cleanup on Redis Streams requires the matching `@mastra/redis-streams` release. With an older one, `unsubscribe()` does nothing while a subscribe is still in flight, and that late subscribe recreates the stream key after `clearTopic` deletes it.
