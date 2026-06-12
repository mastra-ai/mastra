---
'@mastra/core': patch
---

Improved channels performance by caching subscription state in `MastraStateAdapter`. Repeated `isSubscribed` and `subscribe` calls for the same thread now skip the storage round-trip after the first successful subscribe.
