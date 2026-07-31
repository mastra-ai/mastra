---
'@mastra/redis-streams': patch
'@mastra/core': patch
---

Thread event subscriptions now acknowledge events after processing them, so persistent PubSub backends like Redis no longer accumulate unacknowledged events over time.
