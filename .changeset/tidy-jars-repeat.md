---
'@mastra/core': patch
---

Fixed unbounded memory growth in the shared event cache when a caching pub/sub is backed by a persistent store such as Redis. Workflow watch events and other instance-local events were still being copied into the shared replay cache even though no other instance could read them. Because those events carry cumulative step results, a single workflow run could add tens of megabytes of cache entries that nothing ever consumed, and each topic left behind an index counter that was never cleaned up. Instance-local events are now delivered live only and skip the cache entirely; replay for agent streams is unchanged. Fixes https://github.com/mastra-ai/mastra/issues/20646
