---
'@mastra/core': patch
---

Fixed crash in CacheKeyGenerator.fromAIV4Part when a tool-invocation part has undefined toolInvocation. This can happen when observational memory seals a partially-streamed assistant message. Also guarded MessageMerger against the same condition.
