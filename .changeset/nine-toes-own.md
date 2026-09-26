---
'@mastra/core': patch
---

Fixed CachingPubSub dropping events that arrive from another caching tier. When a durable agent's stream cache follows a source bus that is itself a CachingPubSub with its own cache (for example a user-supplied CachingPubSub passed to new Mastra({ pubsub })), events from that tier already carry an index and were treated as local echoes and discarded — they never reached the agent's subscribers and could not be replayed. The follower now only treats indexed events as echoes when the source shares the same transport; foreign-indexed events are cached under a fresh index and republished so live delivery and replay both work across tiers.
