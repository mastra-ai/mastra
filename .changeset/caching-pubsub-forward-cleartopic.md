---
'@mastra/core': patch
---

**Fixed** — `CachingPubSub.clearTopic` now forwards to the wrapped transport. Because the durable-agent runtime wraps every pubsub in `CachingPubSub`, clearing a topic previously dropped only the in-memory cache and never told a persistent backend (e.g. Redis Streams) to delete its stream — so finished runs' streams leaked. It now also calls `clearTopic` on the inner transport when the inner implements it.
