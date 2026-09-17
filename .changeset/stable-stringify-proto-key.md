---
'@mastra/core': patch
---

Fix `stableStringify` dropping own `__proto__` keys, which collapsed distinct values onto one cache key (affecting message dedup in `CacheKeyGenerator.fromDBParts` and the agent response cache).
