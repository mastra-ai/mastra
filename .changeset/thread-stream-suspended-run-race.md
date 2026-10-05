---
'@mastra/core': patch
---

Fixed thread streams reporting a run as completed when it was actually waiting on tool approval or a suspended tool. With a pubsub that has publish latency (such as `@mastra/redis-streams`), the thread published `run-completed` instead of `run-suspended`. That unblocked the thread, made remote subscribers drop the pending approval, and recorded the turn as finished. Suspended runs now publish `run-suspended` regardless of pubsub latency.
