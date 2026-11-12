---
'@mastra/core': patch
---

Honor an Agent's pubsub for DurableAgent thread coordination so replicas sharing that bus can discover active runs, receive thread updates, and coordinate thread leases and Stop requests. Preserve injected coordination buses when agents are forked.
